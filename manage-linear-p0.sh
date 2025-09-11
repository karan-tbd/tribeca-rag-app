#!/bin/bash

# Label P0 issues and optionally mark one as Done
# Usage:
#   ./manage-linear-p0.sh <LINEAR_API_TOKEN> [mark_done_title]
# If mark_done_title is provided, the script will move that issue to Done state.

set -eo pipefail

# helper for literal '$' in heredocs
DOLLAR='$'

TOKEN="${1:-}"
MARK_DONE_TITLE="${2:-}"
PROJECT_ID="9ff76161-bb4d-44f2-bea8-98d0f4da29b5"

if [ -z "$TOKEN" ]; then
  echo "❌ Please pass your Linear API token"
  exit 1
fi

jq_exists=$(command -v jq || true)
if [ -z "$jq_exists" ]; then
  echo "ℹ️  'jq' not found. This script will use Python for JSON parsing."
fi

# Helper to run GraphQL
ql() {
  local body="$1"
  curl -sS -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: $TOKEN" \
    -d "$body" \
    https://api.linear.app/graphql
}

# 1) Get project, team, labels, and issues
echo "🔎 Loading project, team, labels and issues..."
PROJECT_QUERY='{
  "query": "query($id:String!){ project(id:$id){ id name url teams{ nodes{ id name } } } }",
  "variables": {"id": "'$PROJECT_ID'"}
}'
PROJECT=$(ql "$PROJECT_QUERY")

TEAM_ID=$(echo "$PROJECT" | python3 -c "import sys, json; d=json.load(sys.stdin); print((d.get('data',{}).get('project',{}).get('teams',{}).get('nodes',[{}])[0].get('id','')))" 2>/dev/null)
if [ -z "$TEAM_ID" ]; then
  echo "❌ Could not determine team ID from project. Response:"; echo "$PROJECT"; exit 1;
fi

echo "📋 Team ID: $TEAM_ID"

LABELS_QUERY='{
  "query": "query($teamId:String!){ team(id:$teamId){ id labels(first:100){ nodes{ id name } } } }",
  "variables": {"teamId": "'$TEAM_ID'"}
}'
LABELS=$(ql "$LABELS_QUERY")

P0_LABEL_ID=$(echo "$LABELS" | python3 -c "import sys, json; d=json.load(sys.stdin); 
labels=d.get('data',{}).get('team',{}).get('labels',{}).get('nodes',[]);
print(next((l['id'] for l in labels if l.get('name','').lower()=='p0'),''))" 2>/dev/null)

if [ -z "$P0_LABEL_ID" ]; then
  echo "🏷️  Creating P0 label on team..."
  CREATE_LABEL='{
    "query":"mutation($input: IssueLabelCreateInput!){ issueLabelCreate(input:$input){ success issueLabel{ id name } } }",
    "variables": {"input": {"name": "P0", "teamId": "'$TEAM_ID'"}}
  }'
  CREATE_LABEL_RES=$(ql "$CREATE_LABEL")
  P0_LABEL_ID=$(echo "$CREATE_LABEL_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('issueLabelCreate',{}).get('issueLabel',{}).get('id',''))" 2>/dev/null)
  if [ -z "$P0_LABEL_ID" ]; then
    echo "❌ Failed to create P0 label. Response:"; echo "$CREATE_LABEL_RES"; exit 1
  fi
fi

echo "🏷️  P0 Label ID: $P0_LABEL_ID"

ISSUES_QUERY='{
  "query": "query($id:String!){ project(id:$id){ id issues(first:250){ nodes{ id identifier title labels{ nodes{ id name } } } } } }",
  "variables": {"id": "'$PROJECT_ID'"}
}'
ISSUES=$(ql "$ISSUES_QUERY")

# Titles we consider P0 for this phase (from PRD)
cat > p0_titles.txt <<'EOF'
Google Sign-In Integration
Row-Level Security Setup
Agent Configuration UI
Agent Persistence Layer
PDF Upload Interface
PDF Processing Pipeline
Session Management
Chat Interface
Prompt Assembly Engine
Confidence Aggregation & Fail-safe
EOF

# 2) Add P0 label to matching issues by title
added=0; skipped=0

# Extract issues to a temp JSON file
echo "$ISSUES" > issues.json

python3 - <<'PY'
import json, sys
# Load issues
with open('issues.json') as f:
    data=json.load(f)
issues = data.get('data',{}).get('project',{}).get('issues',{}).get('nodes',[])
# Load titles
with open('p0_titles.txt') as f:
    p0_titles = set(x.strip() for x in f if x.strip())

# Build a worklist
work = []
for it in issues:
    title = (it.get('title') or '').strip()
    if title in p0_titles:
        has_p0 = any((l.get('name','').lower()=='p0') for l in it.get('labels',{}).get('nodes',[]))
        work.append({
            'id': it.get('id'),
            'identifier': it.get('identifier'),
            'title': title,
            'has_p0': has_p0,
            'label_ids': [l.get('id') for l in it.get('labels',{}).get('nodes',[]) if l.get('id')]
        })

with open('p0_work.json','w') as f:
    json.dump(work,f)
PY

# Iterate and update labels as needed
if [ -s p0_work.json ]; then
  total=$(python3 -c "import json; print(len(json.load(open('p0_work.json'))))")
  echo "🔧 Considering $total candidate P0 issues..."
else
  echo "⚠️  No matching issues by title found in project."
fi

for row in $(python3 - <<'PY'
import json
for it in json.load(open('p0_work.json')):
    print(it['id'])
PY
); do
  TITLE=$(python3 - <<PY
import json
for it in json.load(open('p0_work.json')):
    if it['id']=='$row':
        print(it['title'])
        break
PY
)
  HAS=$(python3 - <<PY
import json
for it in json.load(open('p0_work.json')):
    if it['id']=='$row':
        print('yes' if it['has_p0'] else 'no')
        break
PY
)
  CURRENT_LABEL_IDS=$(python3 - <<PY
import json
for it in json.load(open('p0_work.json')):
    if it['id']=='$row':
        print(','.join(it['label_ids']))
        break
PY
)
  if [ "$HAS" = "yes" ]; then
    echo "⏭️  $TITLE already labeled P0"; skipped=$((skipped+1)); continue;
  fi
  # Construct new labelIds (keep existing + add P0)
  if [ -n "$CURRENT_LABEL_IDS" ]; then
    NEW_LABELS="$CURRENT_LABEL_IDS,$P0_LABEL_ID"
  else
    NEW_LABELS="$P0_LABEL_ID"
  fi
  # Build labelIds array JSON
  LABEL_IDS_JSON=$(python3 - <<PY
import json
print(json.dumps("$NEW_LABELS".split(',')))
PY
)
  UPDATE_BODY=$(cat <<JSON
{
  "query": "mutation(${DOLLAR}id:String!,${DOLLAR}input: IssueUpdateInput!){ issueUpdate(id:${DOLLAR}id, input:${DOLLAR}input){ success issue{ id title labels{ nodes{ name } } } } }",
  "variables": {"id": "$row", "input": {"labelIds": $LABEL_IDS_JSON}}
}
JSON
)
  RES=$(ql "$UPDATE_BODY")
  OK=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('data',{}).get('issueUpdate',{}).get('success') else 'no')" 2>/dev/null || true)
  if [ "$OK" = "yes" ]; then
  echo "✅ Labeled P0: $TITLE"
  added=$((added+1))
else
  echo "⚠️  Failed to label: $TITLE"
  echo "$RES"
fi

done

echo "\n📊 Summary: added=$added, skipped=$skipped"

# 3) Optionally move one issue to Done
if [ -n "$MARK_DONE_TITLE" ]; then
  echo "\n🧭 Marking issue as Done by title: $MARK_DONE_TITLE"
  # Find issue ID by querying issues with filter
  FIND_ISSUE='{
    "query":"query($proj: ID, $title: String!){ issues(first:5, filter:{ project:{ id:{ eq:$proj }}, title:{ eq:$title }}){ nodes{ id title } } }",
    "variables": {"proj": "'$PROJECT_ID'", "title": "'$MARK_DONE_TITLE'"}
  }'
  FIND_RES=$(ql "$FIND_ISSUE")
  ISSUE_ID=$(echo "$FIND_RES" | python3 - <<'PY'
import sys,json
try:
  d=json.load(sys.stdin)
  nodes=(d.get('data',{}).get('issues',{}).get('nodes') or [])
  sys.stdout.write(nodes[0]['id'] if nodes else "")
except Exception:
  sys.stdout.write("")
PY
)
  # Fallback parser if Python failed
  if [ -z "$ISSUE_ID" ]; then
    ISSUE_ID=$(echo "$FIND_RES" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -n1)
  fi
  if [ -z "$ISSUE_ID" ]; then echo "❌ Could not find issue titled: $MARK_DONE_TITLE"; echo "$FIND_RES"; exit 1; fi
  # Get team states and locate Done
  STATES_Q='{
    "query":"query($teamId:String!){ team(id:$teamId){ id states{ nodes{ id name type } } } }",
    "variables": {"teamId": "'$TEAM_ID'"}
  }'
  STATES=$(ql "$STATES_Q")
  if [ -z "$STATES" ]; then
    sleep 1
    STATES=$(ql "$STATES_Q")
  fi
  if [ -z "$STATES" ]; then echo "❌ Failed to load team states"; echo "$STATES_Q"; exit 1; fi
  DONE_STATE_ID=$(echo "$STATES" | python3 - <<'PY'
import sys,json
try:
  d=json.load(sys.stdin)
  states=d.get('data',{}).get('team',{}).get('states',{}).get('nodes',[])
  # Prefer type COMPLETED, else name Done (case-insensitive)
  for s in states:
      if (s.get('type','').lower()=='completed'):
          sys.stdout.write(s.get('id',''))
          break
  else:
      for s in states:
          if (s.get('name','').lower()=='done'):
              sys.stdout.write(s.get('id',''))
              break
except Exception:
  sys.stdout.write("")
PY
)
  # Fallback: grep for name "Done"
  if [ -z "$DONE_STATE_ID" ]; then
    DONE_STATE_ID=$(echo "$STATES" | tr -d '\n' | sed -n 's/.*{"id":"\([^"]*\)","name":"Done","type":"completed".*/\1/p')
  fi
  if [ -z "$DONE_STATE_ID" ]; then echo "❌ Could not find a Done/Completed state"; echo "$STATES"; exit 1; fi
  UPDATE_STATE='{
    "query": "mutation($id:String!,$input: IssueUpdateInput!){ issueUpdate(id:$id, input:$input){ success issue{ id title state{ name } } } }",
    "variables": {"id": "'$ISSUE_ID'", "input": {"stateId": "'$DONE_STATE_ID'"}}
  }'
  RES=$(ql "$UPDATE_STATE")
  echo "$RES" | python3 -m json.tool 2>/dev/null || echo "$RES"
  echo "✅ Updated state to Done for: $MARK_DONE_TITLE"
fi

# Cleanup
rm -f issues.json p0_titles.txt p0_work.json 2>/dev/null || true

