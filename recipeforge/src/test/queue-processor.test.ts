import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { existsSync, unlinkSync, writeFileSync, readFileSync } from "fs";
import { resolve } from "path";

const PYTHON = "C:/Users/bounc/AppData/Local/Programs/Python/Python312/python.exe";
const SCRIPT = resolve(__dirname, "../../process_queue.py");
const LOCK_FILE = resolve(__dirname, "../../.queue-lock");

function rmLock() { if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE); }
beforeEach(rmLock);
afterAll(rmLock);

describe("Lock file behavior", () => {
  it("creates and cleans up lock during normal run", () => {
    const r = spawnSync(PYTHON, [SCRIPT], { timeout: 30000, encoding: "utf-8" });
    expect(r.status).toBe(0);
    expect(existsSync(LOCK_FILE)).toBe(false);
  });

  it("skips when active lock exists", () => {
    writeFileSync(LOCK_FILE, String(process.pid));
    const r = spawnSync(PYTHON, [SCRIPT], { timeout: 15000, encoding: "utf-8" });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Lock active");
    expect(existsSync(LOCK_FILE)).toBe(true);
  });

  it("removes stale lock and proceeds", () => {
    // Create a lock file, then backdate it
    writeFileSync(LOCK_FILE, String(process.pid));
    // Use PowerShell to set old creation time
    const ps = spawnSync("powershell", [
      "-Command",
      `(Get-Item '${LOCK_FILE}').LastWriteTime = (Get-Date).AddMinutes(-15)`,
    ]);
    if (ps.status !== 0) {
      // Fallback: just remove it and skip
      rmLock();
      return;
    }

    const r = spawnSync(PYTHON, [SCRIPT], { timeout: 30000, encoding: "utf-8" });
    expect(r.status).toBe(0);
    expect(existsSync(LOCK_FILE)).toBe(false);
  });
});

describe("API connectivity", () => {
  it("auth endpoint responds 200", async () => {
    const res = await fetch("https://recipeforge-three.vercel.app/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase: "bready" }),
    });
    expect(res.status).toBe(200);
  });

  it("requests endpoint returns array", async () => {
    const auth = await fetch("https://recipeforge-three.vercel.app/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase: "bready" }),
    });
    const cookies = auth.headers.get("set-cookie") ?? "";
    const res = await fetch(
      "https://recipeforge-three.vercel.app/api/requests?status=pending",
      { headers: { Cookie: cookies } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.requests)).toBe(true);
  });
});

describe("Clean exit", () => {
  it("exits 0 and logs pending count", () => {
    const r = spawnSync(PYTHON, [SCRIPT], { timeout: 30000, encoding: "utf-8" });
    expect(r.status).toBe(0);
    expect(r.stdout.length).toBeGreaterThan(0);
    // Should mention either "No pending" or "Pending requests: N"
    const hasOutput = r.stdout.includes("No pending") || r.stdout.includes("Pending requests");
    expect(hasOutput).toBe(true);
  });
});

describe("Env vars", () => {
  it(".env.local has DEEPSEEK config", () => {
    const envPath = resolve(__dirname, "../../.env.local");
    if (!existsSync(envPath)) return;
    const env = readFileSync(envPath, "utf-8");
    expect(/DEEPSEEK_API_KEY\s*=\s*\S+/.test(env)).toBe(true);
    expect(/DEEPSEEK_ANTHROPIC_URL\s*=\s*\S+/.test(env)).toBe(true);
    expect(/DEEPSEEK_RESEARCH_MODEL\s*=\s*\S+/.test(env)).toBe(true);
  });
});

describe("Scheduled task compatibility", () => {
  it("script works when run from project directory with full path", () => {
    // Simulates Task Scheduler: absolute paths, specific working dir
    const r = spawnSync(PYTHON, [SCRIPT], {
      cwd: resolve(__dirname, "../.."),
      timeout: 30000,
      encoding: "utf-8",
      env: { ...process.env }, // Task Scheduler has limited env
    });
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
  });
});
