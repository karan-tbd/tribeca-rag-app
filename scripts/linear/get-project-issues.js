#!/usr/bin/env node
import https from 'https';

const PROJECT_ID = process.argv[2] || '9ff76161-bb4d-44f2-bea8-98d0f4da29b5';
const TOKEN = process.argv[3];
if (!TOKEN) { 
  console.error('Usage: node get-project-issues.js <PROJECT_ID> <LINEAR_API_TOKEN>'); 
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

(async () => {
  try {
    const data = await gql(`
      query($projectId: String!) {
        project(id: $projectId) {
          id
          name
          url
          issues(first: 100) {
            nodes {
              id
              identifier
              title
              description
              state {
                id
                name
                type
              }
              assignee {
                id
                name
                email
              }
              labels {
                nodes {
                  id
                  name
                }
              }
              projectMilestone {
                id
                name
              }
              estimate
              priority
              createdAt
              updatedAt
              url
            }
          }
        }
      }
    `, { projectId: PROJECT_ID });

    if (!data || !data.project) {
      console.error('Project not found');
      process.exit(2);
    }

    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error fetching project issues:', error.message);
    process.exit(1);
  }
})();
