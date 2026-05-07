#!/bin/bash
# Process RecipeForge request queue using DeepSeek backend (deepclaude pattern).
# Reads API keys from .env.local. Run from terminal: bash process-queue.sh
#
# Uses 'claude -p' with ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN
# redirected to DeepSeek's Anthropic-compatible endpoint.
# Same pattern as the wow bot's claude_runner.py -- no permission prompts.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP="https://recipeforge-three.vercel.app"
PASS="bready"
PYTHON="C:/Users/bounc/AppData/Local/Programs/Python/Python312/python.exe"
export CLAUDE_BIN="C:/Users/bounc/.local/bin/claude.exe"

# Load vars from .env.local
if [ -f "$SCRIPT_DIR/.env.local" ]; then
  export $(grep -E '^DEEPSEEK_(API_KEY|ANTHROPIC_URL|RESEARCH_MODEL)=' "$SCRIPT_DIR/.env.local" | xargs)
fi

# Auth + fetch pending requests
curl -s -X POST "$APP/api/auth" -H "Content-Type: application/json" \
  -d "{\"passphrase\":\"$PASS\"}" -c /tmp/rf-cookies.txt > /dev/null
PENDING=$(curl -s "$APP/api/requests?status=pending" -b /tmp/rf-cookies.txt)

# Check if there are pending requests
COUNT=$(echo "$PENDING" | "$PYTHON" -c "import sys,json;print(len(json.load(sys.stdin).get('requests',[])))" 2>/dev/null || echo 0)

if [ "$COUNT" = "0" ]; then
  echo "No pending requests."
  exit 0
fi

echo "Found $COUNT pending request(s)."

# Process each one via claude -p through DeepSeek backend
echo "$PENDING" | "$PYTHON" -c "
import sys, json, subprocess, urllib.request, os

data = json.load(sys.stdin)
APP = '$APP'
API_KEY = os.environ.get('DEEPSEEK_API_KEY', '')
ANTHROPIC_URL = os.environ.get('DEEPSEEK_ANTHROPIC_URL', 'https://api.deepseek.com/anthropic')
MODEL = os.environ.get('DEEPSEEK_RESEARCH_MODEL', 'deepseek-v4-pro')

for req in data.get('requests', []):
    rid = req['id']
    prompt = req['prompt']
    print(f'--- Processing: {prompt} ---')

    # Build scrubbed env: strip ANTHROPIC_*, inject DeepSeek backend
    env = {}
    for k, v in os.environ.items():
        if not k.upper().startswith('ANTHROPIC'):
            env[k] = v
    env['ANTHROPIC_BASE_URL'] = ANTHROPIC_URL
    env['ANTHROPIC_AUTH_TOKEN'] = API_KEY

    # Pipe prompt via stdin (not -p inline) -- DeepSeek hangs on inline
    r = subprocess.run(
        [os.environ.get('CLAUDE_BIN', 'claude'), '-p', '--model', MODEL,
         '--allowedTools', 'WebSearch,WebFetch',
         '--dangerously-skip-permissions'],
        input=f'''Research \"{prompt}\" and create a beautiful self-contained HTML recipe page. Use WebSearch to find authentic sources.

Include: Fraunces + Newsreader Google Fonts (via @import), warm cookbook color palette (no #000, no #fff), paper texture via CSS, hand-crafted inline SVGs of the finished dish AND key techniques, cultural context paragraph, precise ingredients with amounts, detailed numbered steps with WHY explanations and sensory cues, 3-5 pro tips, storage guidance, alternative methods if applicable.

Return ONLY the complete HTML document starting with <!doctype html>. No markdown wrapping, no code fences, no explanation -- just the HTML.''',
        capture_output=True, text=True, timeout=300, env=env)

    html = r.stdout.strip()
    if not html.startswith('<!doctype html>'):
        start = html.find('<!doctype html>')
        if start >= 0: html = html[start:]

    if not html.startswith('<!doctype html>'):
        print(f'  ERROR: no HTML (stdout={len(r.stdout)} chars, stderr={r.stderr[:200]})')
        continue

    # Extract title from <title> tag
    import re
    tm = re.search(r'<title>(.*?)</title>', html, re.I)
    title = tm.group(1).split('·')[0].strip()[:100] if tm else prompt

    # Import to app
    body = json.dumps({'title':title,'description':'','cuisine':'other','category':'other','prepTime':15,'cookTime':30,'totalTime':45,'difficulty':'medium','servings':4,'tags':[],'html':html})
    ir = urllib.request.Request(f'{APP}/api/recipes/import', data=body.encode(), headers={'Content-Type':'application/json'})
    imported = json.loads(urllib.request.urlopen(ir).read())
    recipe_id = imported.get('id')

    # Mark complete
    pr = urllib.request.Request(f'{APP}/api/requests/{rid}', data=json.dumps({'status':'completed','recipe_id':recipe_id}).encode(), headers={'Content-Type':'application/json'}, method='PATCH')
    urllib.request.urlopen(pr)
    print(f'  DONE: {title} ({recipe_id})')

print('All done.')
"
