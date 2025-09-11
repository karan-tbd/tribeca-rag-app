#!/bin/bash

# Quick Linear Status Check using curl
# Usage: ./check-linear-status.sh <LINEAR_API_TOKEN>

LINEAR_API_TOKEN="$1"

if [ -z "$LINEAR_API_TOKEN" ]; then
    echo "❌ Please provide your Linear API token as an argument"
    echo "Usage: ./check-linear-status.sh <LINEAR_API_TOKEN>"
    echo ""
    echo "Get your API token from: https://linear.app/settings/api"
    exit 1
fi

echo "🔍 Checking Linear workspace status..."
echo ""

# Function to make GraphQL queries
query_linear() {
    local query="$1"
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: $LINEAR_API_TOKEN" \
        -d "$query" \
        https://api.linear.app/graphql
}

# Step 1: Get user info and teams
echo "📋 Getting user and team information..."
USER_QUERY='{
  "query": "query { viewer { id name email } teams { nodes { id name key } } }"
}'

USER_RESPONSE=$(query_linear "$USER_QUERY")
echo "User Info Response:"
echo "$USER_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$USER_RESPONSE"
echo ""

# Step 2: Get projects
echo "📁 Getting projects..."
PROJECTS_QUERY='{
  "query": "query { projects(first: 50) { nodes { id name description url targetDate progress state teams { nodes { name } } } } }"
}'

PROJECTS_RESPONSE=$(query_linear "$PROJECTS_QUERY")
echo "Projects Response:"
echo "$PROJECTS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$PROJECTS_RESPONSE"
echo ""

# Check if we can find the RAG project
echo "🔍 Looking for RAG Framework App v1 project..."
RAG_PROJECT_ID=$(echo "$PROJECTS_RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    projects = data.get('data', {}).get('projects', {}).get('nodes', [])
    for project in projects:
        if project.get('name') == 'RAG Framework App v1' or project.get('key') == 'RAG':
            print(project.get('id', ''))
            break
except:
    pass
" 2>/dev/null)

if [ -n "$RAG_PROJECT_ID" ]; then
    echo "🎯 Found RAG Framework App v1 project!"
    echo "Project ID: $RAG_PROJECT_ID"
    
    # Get issues for the RAG project
    echo ""
    echo "📋 Getting issues for RAG project..."
    ISSUES_QUERY="{
      \"query\": \"query GetProjectIssues(\\\$projectId: String!) { project(id: \\\$projectId) { issues(first: 100) { nodes { id identifier title state { name type } priority estimate assignee { name } labels { nodes { name } } } } } }\",
      \"variables\": { \"projectId\": \"$RAG_PROJECT_ID\" }
    }"
    
    ISSUES_RESPONSE=$(query_linear "$ISSUES_QUERY")
    echo "Issues Response:"
    echo "$ISSUES_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ISSUES_RESPONSE"
    
    # Save project info
    echo ""
    echo "💾 Saving project info to linear-project-info.json..."
    echo "$PROJECTS_RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    projects = data.get('data', {}).get('projects', {}).get('nodes', [])
    for project in projects:
        if project.get('name') == 'RAG Framework App v1' or project.get('key') == 'RAG':
            project_info = {
                'projectId': project.get('id'),
                'name': project.get('name'),
                'key': project.get('key'),
                'url': project.get('url'),
                'progress': project.get('progress', 0),
                'state': project.get('state')
            }
            with open('linear-project-info.json', 'w') as f:
                json.dump(project_info, f, indent=2)
            print('✅ Project info saved to linear-project-info.json')
            break
except Exception as e:
    print(f'❌ Error saving project info: {e}')
" 2>/dev/null
    
else
    echo "❌ RAG Framework App v1 project not found"
    echo "   Available projects:"
    echo "$PROJECTS_RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    projects = data.get('data', {}).get('projects', {}).get('nodes', [])
    if not projects:
        print('   No projects found in workspace')
    else:
        for project in projects:
            print(f\"   - {project.get('name', 'Unnamed')} ({project.get('key', 'No key')})\")
except:
    print('   Could not parse projects response')
" 2>/dev/null
    
    echo ""
    echo "🚀 Next step: Create the RAG Framework App v1 project"
    echo "   Run: node scripts/linear/create-linear-project.js <YOUR_LINEAR_API_TOKEN>"
fi

echo ""
echo "✅ Linear status check complete!"
