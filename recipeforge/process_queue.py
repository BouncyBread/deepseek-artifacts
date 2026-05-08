"""Process RecipeForge request queue using DeepSeek backend (deepclaude pattern).
Same pattern as the wow bot's claude_runner.py — no permission prompts.
Usage: python process_queue.py
"""
import json, os, re, subprocess, time, traceback, urllib.request, sys, glob

APP = "https://recipeforge-three.vercel.app"
PASS = "bready"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOCK_FILE = os.path.join(SCRIPT_DIR, ".queue-lock")
LOG_FILE = os.path.join(SCRIPT_DIR, "queue-processor.log")

def log(msg):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except:
        pass

log("=== Queue processor starting ===")

# Prevent overlapping runs
if os.path.exists(LOCK_FILE):
    try:
        lock_age = time.time() - os.path.getmtime(LOCK_FILE)
        if lock_age < 600:
            log(f"Lock active ({lock_age:.0f}s), exiting.")
            sys.exit(0)
        log(f"Removing stale lock ({lock_age:.0f}s)")
        os.remove(LOCK_FILE)
    except Exception as e:
        log(f"Lock error: {e}")
        traceback.print_exc()

try:
    with open(LOCK_FILE, "w") as f:
        f.write(str(os.getpid()))
    log("Lock acquired")

    # Load config from .env.local
    env_path = os.path.join(SCRIPT_DIR, ".env.local")
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                m = re.match(r'^(DEEPSEEK_(?:API_KEY|ANTHROPIC_URL|RESEARCH_MODEL)|BRAVE_SEARCH_API_KEY)\s*=\s*(.+)', line.strip())
                if m:
                    env_vars[m.group(1)] = m.group(2).strip()
    log(f"Loaded {len(env_vars)} env vars")

    API_KEY = env_vars.get("DEEPSEEK_API_KEY", "")
    ANTHROPIC_URL = env_vars.get("DEEPSEEK_ANTHROPIC_URL", "https://api.deepseek.com/anthropic")
    MODEL = env_vars.get("DEEPSEEK_RESEARCH_MODEL", "deepseek-v4-pro")

    # Auth
    log("Authenticating...")
    auth_req = urllib.request.Request(
        f"{APP}/api/auth",
        data=json.dumps({"passphrase": PASS}).encode(),
        headers={"Content-Type": "application/json"},
    )
    resp = urllib.request.urlopen(auth_req)
    cookies = resp.headers.get_all("Set-Cookie")
    log("Auth OK")

    # Fetch pending
    pending_req = urllib.request.Request(f"{APP}/api/requests?status=pending")
    if cookies:
        pending_req.add_header("Cookie", "; ".join(c.split(";")[0] for c in cookies))
    pending_resp = urllib.request.urlopen(pending_req)
    requests_list = json.loads(pending_resp.read()).get("requests", [])
    log(f"Pending requests: {len(requests_list)}")

    if not requests_list:
        sys.exit(0)

    for req in requests_list:
        rid = req["id"]
        prompt = req["prompt"]
        log(f"Processing: {prompt}")

        sub_env = {k: v for k, v in os.environ.items() if not k.upper().startswith("ANTHROPIC")}
        sub_env["ANTHROPIC_BASE_URL"] = ANTHROPIC_URL
        sub_env["ANTHROPIC_AUTH_TOKEN"] = API_KEY

        try:
            # Brave Search to find authentic sources
            search_urls = []
            search_context = ""
            try:
                import urllib.parse
                brave_key = env_vars.get("BRAVE_SEARCH_API_KEY", "")
                if brave_key:
                    sq = urllib.parse.quote(f"{prompt} authentic recipe traditional")
                    sr = urllib.request.Request(
                        f"https://api.search.brave.com/res/v1/web/search?q={sq}&count=3",
                        headers={"Accept": "application/json", "Accept-Encoding": "gzip",
                                 "X-Subscription-Token": brave_key})
                    sdata = json.loads(urllib.request.urlopen(sr, timeout=10).read())
                    results = sdata.get("web", {}).get("results", [])
                    search_urls = [r["url"] for r in results[:3] if r.get("url")]
                    search_context = "\n".join(
                        f"{r['title']}: {r.get('description', '')}" for r in results[:3]
                    )
                    log(f"  Brave search: {len(results)} results")
            except Exception as e:
                log(f"  Search skipped: {e}")

            # Build prompt — pass URLs so Claude can WebFetch them for deep research
            prompt_text = f'Create a beautiful self-contained HTML recipe page for "{prompt}".\n\n'
            if search_urls:
                prompt_text += "FETCH THESE SOURCES FIRST using WebFetch. Read each one to understand the authentic recipe.\n"
                for i, url in enumerate(search_urls, 1):
                    prompt_text += f"  {i}. {url}\n"
                prompt_text += "\nAfter reading, synthesize the best elements from each source.\n\n"
            elif search_context:
                prompt_text += f"RESEARCH:\n{search_context}\n\n"
            prompt_text += 'Include: Fraunces + Newsreader Google Fonts (via @import), warm cookbook colors (no #000 #fff), paper texture CSS, hand-crafted inline SVGs of the finished dish and key techniques, cultural context, precise ingredients, detailed steps with WHY and sensory cues, 3-5 pro tips, storage guidance.\n\nReturn ONLY the complete HTML starting with <!doctype html>. No markdown wrapping.'

            r = subprocess.run(
                ["claude", "-p", "--model", MODEL, "--allowedTools", "WebFetch"],
                input=prompt_text,
                capture_output=True, text=True, timeout=900, env=sub_env)
            log(f"Claude exit: {r.returncode}, stdout: {len(r.stdout)} chars")
        except subprocess.TimeoutExpired:
            log(f"  TIMEOUT after 600s")
            continue
        except FileNotFoundError:
            log(f"  ERROR: claude binary not found on PATH")
            continue
        except Exception as e:
            log(f"  Claude error: {e}")
            continue

        html = r.stdout.strip()
        if not html.startswith("<!doctype html>"):
            start = html.find("<!doctype html>")
            if start >= 0:
                html = html[start:]

        if not html.startswith("<!doctype html>"):
            log(f"  Bad output: starts with '{html[:100]}'")
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
            log(f"  Imported: {recipe_id}")
        except Exception as e:
            log(f"  Import failed: {e}")
            continue

        # Mark done
        try:
            pr = urllib.request.Request(f"{APP}/api/requests/{rid}",
                data=json.dumps({"status": "completed", "recipe_id": recipe_id}).encode(),
                headers={"Content-Type": "application/json"}, method="PATCH")
            if cookies:
                pr.add_header("Cookie", "; ".join(c.split(";")[0] for c in cookies))
            urllib.request.urlopen(pr)
            log(f"  Complete: {title}")
        except Exception as e:
            log(f"  Patch failed: {e}")
            continue

    log("All done.")

except Exception as e:
    log(f"FATAL: {e}")
    traceback.print_exc()
    sys.exit(2)

finally:
    if os.path.exists(LOCK_FILE):
        try:
            os.remove(LOCK_FILE)
        except:
            pass
    # Rotate log: keep only last 2 days of entries
    try:
        if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > 500_000:
            with open(LOG_FILE) as f:
                lines = f.readlines()
            cutoff = time.time() - 172800  # 48 hours
            kept = []
            for line in lines:
                try:
                    ts_str = line[1:20]  # [YYYY-MM-DD HH:MM:SS]
                    ts = time.mktime(time.strptime(ts_str, "%Y-%m-%d %H:%M:%S"))
                    if ts > cutoff:
                        kept.append(line)
                except:
                    kept.append(line)  # keep lines without parseable timestamps
            with open(LOG_FILE, "w") as f:
                f.writelines(kept)
            log(f"Log rotated: {len(lines)} -> {len(kept)} lines")
    except:
        pass

    log("=== Queue processor exiting ===")
