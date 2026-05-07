"""Process RecipeForge request queue using DeepSeek backend (deepclaude pattern).
Same pattern as the wow bot's claude_runner.py — no permission prompts.
Usage: python process_queue.py
"""
import json, os, re, subprocess, time, urllib.request, sys

APP = "https://recipeforge-three.vercel.app"
PASS = "bready"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOCK_FILE = os.path.join(SCRIPT_DIR, ".queue-lock")

# Prevent overlapping runs
if os.path.exists(LOCK_FILE):
    lock_age = time.time() - os.path.getmtime(LOCK_FILE)
    if lock_age < 600:
        print(f"Lock active ({lock_age:.0f}s), skipping.")
        sys.exit(0)
    os.remove(LOCK_FILE)

with open(LOCK_FILE, "w") as f:
    f.write(str(os.getpid()))

try:
    # Load config
    env_path = os.path.join(SCRIPT_DIR, ".env.local")
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                m = re.match(r'^(DEEPSEEK_(?:API_KEY|ANTHROPIC_URL|RESEARCH_MODEL))\s*=\s*(.+)', line.strip())
                if m:
                    env_vars[m.group(1)] = m.group(2).strip()

    API_KEY = env_vars.get("DEEPSEEK_API_KEY", "")
    ANTHROPIC_URL = env_vars.get("DEEPSEEK_ANTHROPIC_URL", "https://api.deepseek.com/anthropic")
    MODEL = env_vars.get("DEEPSEEK_RESEARCH_MODEL", "deepseek-v4-pro")

    # Auth
    auth_req = urllib.request.Request(
        f"{APP}/api/auth",
        data=json.dumps({"passphrase": PASS}).encode(),
        headers={"Content-Type": "application/json"},
    )
    resp = urllib.request.urlopen(auth_req)
    cookies = resp.headers.get_all("Set-Cookie")

    # Fetch pending
    pending_req = urllib.request.Request(f"{APP}/api/requests?status=pending")
    if cookies:
        pending_req.add_header("Cookie", "; ".join(c.split(";")[0] for c in cookies))
    pending_resp = urllib.request.urlopen(pending_req)
    requests_list = json.loads(pending_resp.read()).get("requests", [])

    if not requests_list:
        print("No pending requests.")
        sys.exit(0)

    print(f"Found {len(requests_list)} pending.")

    for req in requests_list:
        rid = req["id"]
        prompt = req["prompt"]
        print(f"--- {prompt} ---")

        sub_env = {k: v for k, v in os.environ.items() if not k.upper().startswith("ANTHROPIC")}
        sub_env["ANTHROPIC_BASE_URL"] = ANTHROPIC_URL
        sub_env["ANTHROPIC_AUTH_TOKEN"] = API_KEY

        try:
            r = subprocess.run(
                ["claude", "-p", "--model", MODEL,
                 "--allowedTools", "WebSearch,WebFetch",
                 "--dangerously-skip-permissions"],
                input=f'Research "{prompt}" and create a beautiful self-contained HTML recipe page. Use WebSearch to find authentic sources.\n\nInclude: Fraunces + Newsreader Google Fonts, warm cookbook colors, paper texture CSS, hand-crafted inline SVGs of the finished dish and key techniques, cultural context, precise ingredients, detailed steps with WHY and sensory cues, 3-5 pro tips, storage guidance.\n\nReturn ONLY the complete HTML starting with <!doctype html>. No markdown wrapping.',
                capture_output=True, text=True, timeout=600, env=sub_env)
        except subprocess.TimeoutExpired:
            print(f"  TIMEOUT")
            continue
        except Exception as e:
            print(f"  CLAUDE ERROR: {e}")
            continue

        html = r.stdout.strip()
        if not html.startswith("<!doctype html>"):
            start = html.find("<!doctype html>")
            if start >= 0:
                html = html[start:]

        if not html.startswith("<!doctype html>"):
            print(f"  BAD OUTPUT (len={len(r.stdout)}, stderr={r.stderr[:200]})")
            continue

        tm = re.search(r"<title>(.*?)</title>", html, re.I)
        title = tm.group(1).split("·")[0].strip()[:100] if tm else prompt

        # Import
        try:
            body = json.dumps({"title": title, "description": "", "cuisine": "other",
                "category": "other", "prepTime": 15, "cookTime": 30, "totalTime": 45,
                "difficulty": "medium", "servings": 4, "tags": [], "html": html})
            ir = urllib.request.Request(f"{APP}/api/recipes/import", data=body.encode(),
                headers={"Content-Type": "application/json"})
            if cookies:
                ir.add_header("Cookie", "; ".join(c.split(";")[0] for c in cookies))
            recipe_id = json.loads(urllib.request.urlopen(ir).read()).get("id")
        except Exception as e:
            print(f"  IMPORT FAILED: {e}")
            continue

        # Mark done
        try:
            pr = urllib.request.Request(f"{APP}/api/requests/{rid}",
                data=json.dumps({"status": "completed", "recipe_id": recipe_id}).encode(),
                headers={"Content-Type": "application/json"}, method="PATCH")
            if cookies:
                pr.add_header("Cookie", "; ".join(c.split(";")[0] for c in cookies))
            urllib.request.urlopen(pr)
        except Exception as e:
            print(f"  PATCH FAILED: {e}")
            continue

        print(f"  DONE: {title} ({recipe_id})")

    print("All done.")

finally:
    if os.path.exists(LOCK_FILE):
        os.remove(LOCK_FILE)
