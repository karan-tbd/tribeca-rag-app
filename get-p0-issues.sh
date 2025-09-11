#!/bin/bash

# Get P0 issues from RAG Framework App v1 project
LINEAR_API_TOKEN="$1"
PROJECT_ID="9ff76161-bb4d-44f2-bea8-98d0f4da29b5"

if [ -z "$LINEAR_API_TOKEN" ]; then
    echo "❌ Please provide your Linear API token"
    exit 1
fi

echo "🔥 Finding P0 (Priority 0) issues in RAG Framework App v1..."
echo "Project ID: $PROJECT_ID"
echo ""

# Get all issues with detailed information including priority and labels
curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: $LINEAR_API_TOKEN" \
    -d "{\"query\":\"query { project(id: \\\"$PROJECT_ID\\\") { issues(first: 100) { nodes { id identifier title description state { name type } priority estimate assignee { name } labels { nodes { name color } } projectMilestone { name } createdAt updatedAt } } } }\"}" \
    https://api.linear.app/graphql > all_issues.json

echo "📋 Analyzing issues for P0 priority and labels..."

python3 -c "
import json
from datetime import datetime

try:
    with open('all_issues.json') as f:
        data = json.load(f)
    
    project = data.get('data', {}).get('project', {})
    issues = project.get('issues', {}).get('nodes', [])
    
    print(f'📊 Total issues found: {len(issues)}')
    print()
    
    # Find P0 issues (priority 1 = Urgent in Linear)
    p0_issues = []
    p0_labeled_issues = []
    
    for issue in issues:
        priority = issue.get('priority', 0)
        labels = [label.get('name', '').lower() for label in issue.get('labels', {}).get('nodes', [])]
        
        # Check for priority 1 (Urgent) or P0 label
        is_p0_priority = priority == 1
        is_p0_labeled = any('p0' in label for label in labels)
        
        if is_p0_priority:
            p0_issues.append(issue)
        if is_p0_labeled:
            p0_labeled_issues.append(issue)
    
    print('🔥 P0 Issues by Priority (Priority = 1/Urgent):')
    if p0_issues:
        for i, issue in enumerate(p0_issues, 1):
            print(f'{i}. {issue.get(\"identifier\", \"??\")}: {issue.get(\"title\", \"Untitled\")}')
            print(f'   Status: {issue.get(\"state\", {}).get(\"name\", \"Unknown\")}')
            print(f'   Priority: {issue.get(\"priority\", \"Unknown\")}')
            if issue.get('assignee'):
                print(f'   Assignee: {issue.get(\"assignee\", {}).get(\"name\", \"Unknown\")}')
            if issue.get('estimate'):
                print(f'   Estimate: {issue.get(\"estimate\")} points')
            if issue.get('projectMilestone'):
                print(f'   Milestone: {issue.get(\"projectMilestone\", {}).get(\"name\", \"Unknown\")}')
            
            labels = issue.get('labels', {}).get('nodes', [])
            if labels:
                label_names = [label.get('name', '') for label in labels]
                print(f'   Labels: {', '.join(label_names)}')
            print()
    else:
        print('   No issues found with Priority = 1 (Urgent)')
    
    print('🏷️  P0 Issues by Label (contains \"p0\"):')
    if p0_labeled_issues:
        for i, issue in enumerate(p0_labeled_issues, 1):
            print(f'{i}. {issue.get(\"identifier\", \"??\")}: {issue.get(\"title\", \"Untitled\")}')
            print(f'   Status: {issue.get(\"state\", {}).get(\"name\", \"Unknown\")}')
            print(f'   Priority: {issue.get(\"priority\", \"Unknown\")}')
            if issue.get('assignee'):
                print(f'   Assignee: {issue.get(\"assignee\", {}).get(\"name\", \"Unknown\")}')
            if issue.get('estimate'):
                print(f'   Estimate: {issue.get(\"estimate\")} points')
            if issue.get('projectMilestone'):
                print(f'   Milestone: {issue.get(\"projectMilestone\", {}).get(\"name\", \"Unknown\")}')
            
            labels = issue.get('labels', {}).get('nodes', [])
            if labels:
                label_names = [label.get('name', '') for label in labels]
                print(f'   Labels: {', '.join(label_names)}')
            print()
    else:
        print('   No issues found with P0 label')
    
    # Show all priority levels for reference
    print('📊 All Issues by Priority Level:')
    priority_counts = {}
    priority_names = {1: 'Urgent (P0)', 2: 'High', 3: 'Medium', 4: 'Low', 0: 'No Priority'}
    
    for issue in issues:
        priority = issue.get('priority', 0)
        priority_counts[priority] = priority_counts.get(priority, 0) + 1
    
    for priority in sorted(priority_counts.keys(), reverse=True):
        name = priority_names.get(priority, f'Priority {priority}')
        count = priority_counts[priority]
        print(f'   {name}: {count} issues')
    
    # Show all unique labels for reference
    print()
    print('🏷️  All Labels in Project:')
    all_labels = set()
    for issue in issues:
        labels = issue.get('labels', {}).get('nodes', [])
        for label in labels:
            all_labels.add(label.get('name', ''))
    
    if all_labels:
        for label in sorted(all_labels):
            print(f'   - {label}')
    else:
        print('   No labels found')
    
    # Combine all P0 issues (either by priority or label)
    all_p0_issues = []
    seen_ids = set()
    
    for issue in p0_issues + p0_labeled_issues:
        issue_id = issue.get('id')
        if issue_id not in seen_ids:
            all_p0_issues.append(issue)
            seen_ids.add(issue_id)
    
    print()
    print(f'🎯 SUMMARY: {len(all_p0_issues)} P0 issues found for this development phase')
    
    if all_p0_issues:
        print()
        print('📋 P0 Issues to Focus On:')
        for i, issue in enumerate(all_p0_issues, 1):
            status = issue.get('state', {}).get('name', 'Unknown')
            estimate = issue.get('estimate', 'No estimate')
            print(f'{i}. {issue.get(\"identifier\", \"??\")}: {issue.get(\"title\", \"Untitled\")}')
            print(f'   Status: {status} | Estimate: {estimate} | Priority: {issue.get(\"priority\", \"Unknown\")}')
        
        # Save P0 issues to file
        p0_data = {
            'projectId': '$PROJECT_ID',
            'p0Issues': all_p0_issues,
            'totalP0Count': len(all_p0_issues),
            'summary': f'{len(all_p0_issues)} P0 issues ready for development'
        }
        
        with open('p0-issues.json', 'w') as f:
            json.dump(p0_data, f, indent=2)
        
        print()
        print('💾 P0 issues saved to p0-issues.json')
    else:
        print()
        print('⚠️  No P0 issues found. You may need to:')
        print('   1. Set priority to \"Urgent\" (1) for critical issues')
        print('   2. Add \"p0\" labels to critical issues')
        print('   3. Review the issue list and prioritize manually')

except Exception as e:
    print(f'❌ Error analyzing issues: {e}')
    print()
    print('Raw response:')
    with open('all_issues.json') as f:
        print(f.read())
"

# Clean up
rm -f all_issues.json

echo ""
echo "✅ P0 analysis complete!"
