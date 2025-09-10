#!/bin/bash

# Simple RAG project status check
LINEAR_API_TOKEN="$1"

if [ -z "$LINEAR_API_TOKEN" ]; then
    echo "❌ Please provide your Linear API token"
    exit 1
fi

echo "🎯 Checking RAG Framework App v1 project..."

# First, let's get all projects to find the correct ID
echo "📁 Finding RAG project..."

curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: $LINEAR_API_TOKEN" \
    -d '{"query":"query { projects(first: 50) { nodes { id name description url state progress } } }"}' \
    https://api.linear.app/graphql > projects.json

echo "Projects found:"
cat projects.json | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    projects = data.get('data', {}).get('projects', {}).get('nodes', [])
    rag_project = None
    
    print(f'Total projects: {len(projects)}')
    for project in projects:
        name = project.get('name', '')
        url = project.get('url', '')
        print(f'- {name} (ID: {project.get(\"id\", \"unknown\")})')
        print(f'  URL: {url}')
        
        if 'RAG' in name.upper() or 'rag-framework' in url.lower():
            rag_project = project
            print('  ⭐ This is the RAG project!')
        print()
    
    if rag_project:
        print('🎯 RAG Project Details:')
        print(f'ID: {rag_project.get(\"id\")}')
        print(f'Name: {rag_project.get(\"name\")}')
        print(f'URL: {rag_project.get(\"url\")}')
        print(f'State: {rag_project.get(\"state\")}')
        print(f'Progress: {rag_project.get(\"progress\", 0)}%')
        
        # Save the project ID for next query
        with open('rag_project_id.txt', 'w') as f:
            f.write(rag_project.get('id', ''))
    else:
        print('❌ RAG project not found')
        
except Exception as e:
    print(f'Error: {e}')
    print('Raw response:')
    print(open('projects.json').read())
"

# If we found the project, get its issues
if [ -f "rag_project_id.txt" ]; then
    PROJECT_ID=$(cat rag_project_id.txt)
    echo ""
    echo "📋 Getting issues for project ID: $PROJECT_ID"
    
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: $LINEAR_API_TOKEN" \
        -d "{\"query\":\"query { project(id: \\\"$PROJECT_ID\\\") { issues(first: 100) { nodes { id identifier title state { name } priority assignee { name } labels { nodes { name } } } } } }\"}" \
        https://api.linear.app/graphql > issues.json
    
    echo "Issues summary:"
    cat issues.json | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    project = data.get('data', {}).get('project', {})
    issues = project.get('issues', {}).get('nodes', [])
    
    print(f'📋 Total issues: {len(issues)}')
    
    if issues:
        # Count by status
        status_counts = {}
        for issue in issues:
            status = issue.get('state', {}).get('name', 'Unknown')
            status_counts[status] = status_counts.get(status, 0) + 1
        
        print('\\nStatus breakdown:')
        for status, count in status_counts.items():
            print(f'  {status}: {count}')
        
        print('\\nRecent issues:')
        for i, issue in enumerate(issues[:10]):
            print(f'{i+1}. {issue.get(\"identifier\", \"??\")}: {issue.get(\"title\", \"Untitled\")}')
            print(f'   Status: {issue.get(\"state\", {}).get(\"name\", \"Unknown\")}')
            if issue.get('assignee'):
                print(f'   Assignee: {issue.get(\"assignee\", {}).get(\"name\", \"Unknown\")}')
            print()
    else:
        print('No issues found')
        
except Exception as e:
    print(f'Error parsing issues: {e}')
    print('Raw response:')
    print(open('issues.json').read())
"

    # Save project info
    python3 -c "
import json
try:
    with open('projects.json') as f:
        projects_data = json.load(f)
    with open('issues.json') as f:
        issues_data = json.load(f)
    
    projects = projects_data.get('data', {}).get('projects', {}).get('nodes', [])
    rag_project = None
    for project in projects:
        if 'RAG' in project.get('name', '').upper():
            rag_project = project
            break
    
    if rag_project:
        issues = issues_data.get('data', {}).get('project', {}).get('issues', {}).get('nodes', [])
        
        project_info = {
            'projectId': rag_project.get('id'),
            'name': rag_project.get('name'),
            'url': rag_project.get('url'),
            'state': rag_project.get('state'),
            'progress': rag_project.get('progress', 0),
            'issueCount': len(issues)
        }
        
        with open('linear-project-info.json', 'w') as f:
            json.dump(project_info, f, indent=2)
        
        print('💾 Project info saved to linear-project-info.json')
    
except Exception as e:
    print(f'Error saving project info: {e}')
"

    # Clean up temp files
    rm -f projects.json issues.json rag_project_id.txt
    
else
    echo "❌ Could not find RAG project"
fi

echo ""
echo "✅ Status check complete!"
