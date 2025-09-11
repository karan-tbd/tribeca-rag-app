#!/bin/bash

# Check RAG Framework App v1 project status
# Usage: ./check-rag-project.sh <LINEAR_API_TOKEN>

LINEAR_API_TOKEN="$1"

if [ -z "$LINEAR_API_TOKEN" ]; then
    echo "❌ Please provide your Linear API token as an argument"
    echo "Usage: ./check-rag-project.sh <LINEAR_API_TOKEN>"
    exit 1
fi

# Extract project ID from the URL: https://linear.app/karans/project/rag-framework-app-v1-e567de65ca52/issues
# The project ID appears to be: e567de65ca52 (the part after the last dash before /issues)
PROJECT_ID="e567de65ca52"

echo "🎯 Checking RAG Framework App v1 project status..."
echo "Project ID: $PROJECT_ID"
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

# Get project details and issues
echo "📋 Getting project details and issues..."
PROJECT_QUERY="{
  \"query\": \"query GetProject(\\\$projectId: String!) { 
    project(id: \\\$projectId) { 
      id 
      name 
      description 
      url 
      targetDate 
      progress 
      state 
      teams { 
        nodes { 
          id 
          name 
        } 
      }
      issues(first: 100) { 
        nodes { 
          id 
          identifier 
          title 
          description
          state { 
            name 
            type 
          } 
          priority 
          estimate 
          assignee { 
            name 
          } 
          labels { 
            nodes { 
              name 
            } 
          }
          projectMilestone {
            id
            name
          }
          createdAt
          updatedAt
        } 
      }
      projectMilestones(first: 20) {
        nodes {
          id
          name
          description
          targetDate
        }
      }
    } 
  }\",
  \"variables\": { \"projectId\": \"$PROJECT_ID\" }
}"

PROJECT_RESPONSE=$(query_linear "$PROJECT_QUERY")

# Check if the query was successful
if echo "$PROJECT_RESPONSE" | grep -q '"errors"'; then
    echo "❌ Error querying project:"
    echo "$PROJECT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$PROJECT_RESPONSE"
    echo ""
    echo "🔍 Let me try to find the project by searching all projects..."
    
    # Fallback: search all projects
    ALL_PROJECTS_QUERY='{
      "query": "query { projects(first: 50) { nodes { id name description url targetDate progress state } } }"
    }'
    
    ALL_PROJECTS_RESPONSE=$(query_linear "$ALL_PROJECTS_QUERY")
    echo "All Projects Response:"
    echo "$ALL_PROJECTS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ALL_PROJECTS_RESPONSE"
    
    # Try to find RAG project
    ACTUAL_PROJECT_ID=$(echo "$ALL_PROJECTS_RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    projects = data.get('data', {}).get('projects', {}).get('nodes', [])
    for project in projects:
        if 'RAG' in project.get('name', '').upper() or 'rag-framework' in project.get('url', '').lower():
            print(project.get('id', ''))
            break
except:
    pass
" 2>/dev/null)
    
    if [ -n "$ACTUAL_PROJECT_ID" ]; then
        echo "🎯 Found RAG project with ID: $ACTUAL_PROJECT_ID"
        PROJECT_ID="$ACTUAL_PROJECT_ID"
        # Retry with correct ID
        PROJECT_QUERY="{
          \"query\": \"query GetProject(\\\$projectId: String!) { project(id: \\\$projectId) { id name description url targetDate progress state teams { nodes { id name } } issues(first: 100) { nodes { id identifier title state { name type } priority estimate assignee { name } labels { nodes { name } } projectMilestone { id name } createdAt } } projectMilestones(first: 20) { nodes { id name description targetDate } } } }\",
          \"variables\": { \"projectId\": \"$PROJECT_ID\" }
        }"
        PROJECT_RESPONSE=$(query_linear "$PROJECT_QUERY")
    else
        echo "❌ Could not find RAG Framework App v1 project"
        exit 1
    fi
fi

echo "✅ Project Response:"
echo "$PROJECT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$PROJECT_RESPONSE"
echo ""

# Parse and display project summary
echo "📊 Project Summary:"
echo "$PROJECT_RESPONSE" | python3 -c "
import json, sys
from datetime import datetime

try:
    data = json.load(sys.stdin)
    project = data.get('data', {}).get('project', {})
    
    if not project:
        print('❌ No project data found')
        sys.exit(1)
    
    print(f\"📁 Name: {project.get('name', 'Unknown')}\"")
    print(f\"🔗 URL: {project.get('url', 'Unknown')}\"")
    print(f\"📈 Progress: {project.get('progress', 0)}%\"")
    print(f\"🎯 State: {project.get('state', 'Unknown')}\"")
    
    if project.get('targetDate'):
        target = datetime.fromisoformat(project['targetDate'].replace('Z', '+00:00'))
        print(f\"📅 Target Date: {target.strftime('%Y-%m-%d')}\"")
    
    # Team info
    teams = project.get('teams', {}).get('nodes', [])
    if teams:
        print(f\"👥 Team: {teams[0].get('name', 'Unknown')}\"")
    
    # Milestones
    milestones = project.get('projectMilestones', {}).get('nodes', [])
    print(f\"🎯 Milestones: {len(milestones)} found\"")
    for milestone in milestones:
        print(f\"   - {milestone.get('name', 'Unnamed')}\"")
    
    # Issues summary
    issues = project.get('issues', {}).get('nodes', [])
    print(f\"📋 Issues: {len(issues)} total\"")
    
    if issues:
        # Count by status
        status_counts = {}
        priority_counts = {}
        
        for issue in issues:
            status = issue.get('state', {}).get('name', 'Unknown')
            priority = issue.get('priority', 0)
            
            status_counts[status] = status_counts.get(status, 0) + 1
            priority_counts[priority] = priority_counts.get(priority, 0) + 1
        
        print('\\n📊 Issue Status Breakdown:')
        for status, count in status_counts.items():
            print(f\"   {status}: {count} issues\")
        
        print('\\n🔥 Priority Breakdown:')
        priority_names = {1: 'Urgent', 2: 'High', 3: 'Medium', 4: 'Low', 0: 'No Priority'}
        for priority, count in sorted(priority_counts.items(), reverse=True):
            name = priority_names.get(priority, f'Priority {priority}')
            print(f\"   {name}: {count} issues\")
        
        print('\\n🔍 Recent Issues (first 5):')
        for issue in issues[:5]:
            print(f\"   {issue.get('identifier', 'Unknown')}: {issue.get('title', 'Untitled')}\"")
            print(f\"     Status: {issue.get('state', {}).get('name', 'Unknown')}\"")
            if issue.get('assignee'):
                print(f\"     Assignee: {issue.get('assignee', {}).get('name', 'Unknown')}\"")
            if issue.get('projectMilestone'):
                print(f\"     Milestone: {issue.get('projectMilestone', {}).get('name', 'Unknown')}\"")
            print('')
    
    # Save project info
    project_info = {
        'projectId': project.get('id'),
        'teamId': teams[0].get('id') if teams else None,
        'name': project.get('name'),
        'url': project.get('url'),
        'progress': project.get('progress', 0),
        'state': project.get('state'),
        'issueCount': len(issues),
        'milestoneCount': len(milestones)
    }
    
    with open('linear-project-info.json', 'w') as f:
        json.dump(project_info, f, indent=2)
    
    print('\\n💾 Project info saved to linear-project-info.json')

except Exception as e:
    print(f'❌ Error parsing project data: {e}')
    import traceback
    traceback.print_exc()
" 2>/dev/null

echo ""
echo "✅ RAG project status check complete!"
