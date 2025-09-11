#!/usr/bin/env node

/**
 * Quick Linear Status Check
 * Usage: node check-linear-status.js <LINEAR_API_TOKEN>
 */

const https = require('https');

const LINEAR_API_TOKEN = process.argv[2];

if (!LINEAR_API_TOKEN) {
  console.error('❌ Please provide your Linear API token as an argument');
  console.error('Usage: node check-linear-status.js <LINEAR_API_TOKEN>');
  console.error('\nGet your API token from: https://linear.app/settings/api');
  process.exit(1);
}

// GraphQL query helper
async function linearQuery(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    
    const options = {
      hostname: 'api.linear.app',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${LINEAR_API_TOKEN}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.errors) {
            reject(new Error(`GraphQL Error: ${JSON.stringify(response.errors)}`));
          } else {
            resolve(response.data);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function checkLinearStatus() {
  try {
    console.log('🔍 Checking Linear workspace status...\n');

    // Step 1: Get user info and teams
    const userQuery = `
      query {
        viewer {
          id
          name
          email
        }
        teams {
          nodes {
            id
            name
            key
          }
        }
      }
    `;
    
    const userInfo = await linearQuery(userQuery);
    console.log(`✅ Authenticated as: ${userInfo.viewer.name} (${userInfo.viewer.email})`);
    console.log(`📋 Teams: ${userInfo.teams.nodes.length} found`);
    userInfo.teams.nodes.forEach(team => {
      console.log(`   - ${team.name} (${team.key})`);
    });
    console.log('');

    // Step 2: Check for existing projects
    const projectsQuery = `
      query {
        projects(first: 50) {
          nodes {
            id
            name
            key
            description
            url
            targetDate
            progress
            state
            teams {
              nodes {
                name
              }
            }
          }
        }
      }
    `;

    const projectsInfo = await linearQuery(projectsQuery);
    console.log(`📁 Projects: ${projectsInfo.projects.nodes.length} found`);
    
    if (projectsInfo.projects.nodes.length === 0) {
      console.log('   No projects found in workspace');
    } else {
      projectsInfo.projects.nodes.forEach(project => {
        console.log(`   - ${project.name} (${project.key || 'No key'})`);
        console.log(`     ID: ${project.id}`);
        console.log(`     State: ${project.state}`);
        console.log(`     Progress: ${project.progress || 0}%`);
        if (project.targetDate) {
          console.log(`     Target: ${new Date(project.targetDate).toLocaleDateString()}`);
        }
        console.log(`     URL: ${project.url}`);
        console.log('');
      });
    }

    // Step 3: Look specifically for RAG Framework App v1
    const ragProject = projectsInfo.projects.nodes.find(p => 
      p.name === 'RAG Framework App v1' || p.key === 'RAG'
    );

    if (ragProject) {
      console.log('🎯 Found RAG Framework App v1 project!');
      console.log(`   Project ID: ${ragProject.id}`);
      console.log(`   URL: ${ragProject.url}`);
      console.log(`   Progress: ${ragProject.progress || 0}%`);
      
      // Get issues for this project
      const issuesQuery = `
        query GetProjectIssues($projectId: String!) {
          project(id: $projectId) {
            issues(first: 100) {
              nodes {
                id
                identifier
                title
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
              }
            }
          }
        }
      `;

      const issuesInfo = await linearQuery(issuesQuery, { projectId: ragProject.id });
      const issues = issuesInfo.project.issues.nodes;
      
      console.log(`\n📋 Issues in RAG project: ${issues.length} found`);
      
      if (issues.length > 0) {
        const statusCounts = {};
        issues.forEach(issue => {
          const status = issue.state.name;
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        
        console.log('\n📊 Issue Status Summary:');
        Object.entries(statusCounts).forEach(([status, count]) => {
          console.log(`   ${status}: ${count} issues`);
        });

        console.log('\n🔍 Recent Issues:');
        issues.slice(0, 5).forEach(issue => {
          console.log(`   ${issue.identifier}: ${issue.title}`);
          console.log(`     Status: ${issue.state.name}`);
          if (issue.assignee) {
            console.log(`     Assignee: ${issue.assignee.name}`);
          }
          if (issue.labels.nodes.length > 0) {
            console.log(`     Labels: ${issue.labels.nodes.map(l => l.name).join(', ')}`);
          }
          console.log('');
        });
      }

      // Save project info
      const projectInfo = {
        projectId: ragProject.id,
        teamId: userInfo.teams.nodes[0]?.id,
        projectUrl: ragProject.url,
        name: ragProject.name,
        key: ragProject.key,
        progress: ragProject.progress,
        issueCount: issues.length
      };

      require('fs').writeFileSync('linear-project-info.json', JSON.stringify(projectInfo, null, 2));
      console.log('💾 Project info saved to linear-project-info.json');

    } else {
      console.log('❌ RAG Framework App v1 project not found');
      console.log('   You may need to create the project first');
    }

  } catch (error) {
    console.error('❌ Error checking Linear status:', error.message);
    process.exit(1);
  }
}

// Run the check
checkLinearStatus();
