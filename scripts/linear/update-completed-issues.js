#!/usr/bin/env node
import https from 'https';

const PROJECT_ID = process.argv[2] || '9ff76161-bb4d-44f2-bea8-98d0f4da29b5';
const TOKEN = process.argv[3];
if (!TOKEN) { 
  console.error('Usage: node update-completed-issues.js <PROJECT_ID> <LINEAR_API_TOKEN>'); 
  process.exit(1);
} 

function gql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    const req = https.request({
      hostname: 'api.linear.app', 
      path: '/graphql', 
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${TOKEN}`,
        'Content-Length': data.length
      }
    }, res => {
      let body = ''; 
      res.on('data', c => body += c); 
      res.on('end', () => { 
        try { 
          const r = JSON.parse(body || '{}'); 
          if (r.errors) {
            reject(new Error(JSON.stringify(r.errors)));
          } else {
            resolve(r.data);
          } 
        } catch (e) { 
          reject(e);
        } 
      });
    });
    req.on('error', reject); 
    req.write(data); 
    req.end();
  });
}

// Issues that are verified as completed based on codebase analysis
const COMPLETED_ISSUES = [
  'KAR-5',  // Google & Microsoft Login Integration
  'KAR-6',  // Row-Level Security Setup  
  'KAR-7',  // Agent Configuration UI
  'KAR-8',  // Agent Persistence Layer
  'KAR-15', // PDF Upload Interface
  'KAR-16', // Session Management API
  'KAR-18', // Chat UI
];

(async () => {
  try {
    console.log('🔍 Fetching project workflow states...');
    
    // First, get the project and its workflow states
    const projectData = await gql(`
      query($projectId: String!) {
        project(id: $projectId) {
          id
          name
          teams {
            nodes {
              id
              states {
                nodes {
                  id
                  name
                  type
                }
              }
            }
          }
          issues(first: 100) {
            nodes {
              id
              identifier
              title
              state {
                id
                name
                type
              }
            }
          }
        }
      }
    `, { projectId: PROJECT_ID });

    if (!projectData || !projectData.project) {
      console.error('❌ Project not found');
      process.exit(2);
    }

    const project = projectData.project;
    const states = project.teams.nodes[0].states.nodes; // Get states from first team
    const issues = project.issues.nodes;

    // Find the "Done" state
    const doneState = states.find(state => 
      state.type === 'completed' || 
      state.name.toLowerCase().includes('done') ||
      state.name.toLowerCase().includes('complete')
    );

    if (!doneState) {
      console.error('❌ Could not find a "Done" or "Completed" state in the workflow');
      console.log('Available states:', states.map(s => `${s.name} (${s.type})`));
      process.exit(3);
    }

    console.log(`✅ Found "Done" state: ${doneState.name} (${doneState.id})`);
    console.log(`📋 Project: ${project.name}`);
    console.log(`🎯 Issues to update: ${COMPLETED_ISSUES.join(', ')}`);
    console.log('');

    let updatedCount = 0;
    let skippedCount = 0;

    for (const issueIdentifier of COMPLETED_ISSUES) {
      const issue = issues.find(i => i.identifier === issueIdentifier);
      
      if (!issue) {
        console.log(`⚠️  Issue ${issueIdentifier} not found in project`);
        continue;
      }

      if (issue.state.id === doneState.id) {
        console.log(`⏭️  ${issueIdentifier}: Already in Done state`);
        skippedCount++;
        continue;
      }

      console.log(`🔄 Updating ${issueIdentifier}: ${issue.title}`);
      console.log(`   From: ${issue.state.name} → To: ${doneState.name}`);

      try {
        const updateResult = await gql(`
          mutation($issueId: String!, $stateId: String!) {
            issueUpdate(id: $issueId, input: { stateId: $stateId }) {
              success
              issue {
                id
                identifier
                state {
                  name
                }
              }
            }
          }
        `, { 
          issueId: issue.id, 
          stateId: doneState.id 
        });

        if (updateResult?.issueUpdate?.success) {
          console.log(`✅ ${issueIdentifier}: Updated successfully`);
          updatedCount++;
        } else {
          console.log(`❌ ${issueIdentifier}: Update failed`);
        }
      } catch (error) {
        console.log(`❌ ${issueIdentifier}: Error updating - ${error.message}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('');
    console.log('📊 Summary:');
    console.log(`   ✅ Updated: ${updatedCount} issues`);
    console.log(`   ⏭️  Skipped: ${skippedCount} issues (already done)`);
    console.log(`   🎯 Total processed: ${updatedCount + skippedCount} issues`);

  } catch (error) {
    console.error('❌ Error updating issues:', error.message);
    process.exit(1);
  }
})();
