import { spawn } from "child_process";

const BACKEND_BASE_URL = process.env.DEEPSEEK_ANTHROPIC_URL || "https://api.deepseek.com/anthropic";
const BACKEND_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
const BACKEND_RESEARCH_MODEL = process.env.DEEPSEEK_RESEARCH_MODEL || "deepseek-v4-pro";

interface RunOptions {
  prompt: string;
  allowedTools?: string[];
  model?: string;
  timeoutMs?: number;
}

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

function buildEnv(): Record<string, string> {
  // Scrub all ANTHROPIC_* vars so the CLI doesn't use personal subscription
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.toUpperCase().startsWith("ANTHROPIC")) {
      env[key] = value ?? "";
    }
  }

  // Inject DeepSeek backend
  env.ANTHROPIC_BASE_URL = BACKEND_BASE_URL;
  env.ANTHROPIC_AUTH_TOKEN = process.env.DEEPSEEK_API_KEY ?? "";

  return env;
}

export async function runHeadless(options: RunOptions): Promise<RunResult> {
  const { prompt, allowedTools = [], model = BACKEND_MODEL, timeoutMs = 300_000 } = options;

  const args = ["-p"]; // stdin mode (required for DeepSeek backend)
  args.push("--model", model);
  if (allowedTools.length > 0) {
    args.push("--allowedTools", allowedTools.join(","));
    // Auto-approve WebFetch requests so the recipe pipeline runs unattended
    args.push("--dangerously-skip-permissions");
  }

  const env = buildEnv();

  return new Promise<RunResult>((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const child: any = spawn("claude", args, {
      env: env as typeof process.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) child.kill("SIGKILL");
        }, 2000);
        resolve({ stdout, stderr, exitCode: -1, timedOut: true });
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("close", (code: number | null) => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        resolve({ stdout, stderr, exitCode: code ?? -1, timedOut: false });
      }
    });

    child.on("error", (err: Error) => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        resolve({ stdout, stderr: stderr + err.message, exitCode: -1, timedOut: false });
      }
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}
