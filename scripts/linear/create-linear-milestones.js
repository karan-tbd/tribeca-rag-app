#!/usr/bin/env node

/**
 * Linear Project Milestones Script
 * Usage: node create-linear-milestones.js <LINEAR_API_TOKEN>
 */

const https = require('https');
const fs = require('fs');

const LINEAR_API_TOKEN = process.argv[2];
const PROJECT_ID_ARG = process.argv[3];
if (!LINEAR_API_TOKEN) {
  console.error('❌ Provide Linear API token');
  process.exit(1);
}

let projectInfo;
if (PROJECT_ID_ARG) {
  projectInfo = { projectId: PROJECT_ID_ARG };
} else {
  try {
    projectInfo = JSON.parse(fs.readFileSync('linear-project-info.json', 'utf8'));
  } catch (e) {
    console.error('❌ linear-project-info.json not found. Provide project id as 3rd arg.');
    process.exit(1);
  }
}

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
          const response = JSON.parse(body || '{}');
          if (response.errors) {
            reject(new Error(`GraphQL Error: ${JSON.stringify(response.errors)}`));
          } else {
            resolve(response.data);
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const EPICS = [
  { name: 'Authentication & User Management', description: 'Secure user access with Google Sign-In via Supabase', targetDate: new Date(Date.now() + 7*24*60*60*1000) },
  { name: 'Agent Configuration', description: 'User-configurable agents with prompts and retrieval parameters', targetDate: new Date(Date.now() + 14*24*60*60*1000) },
  { name: 'Document Ingestion & Indexing', description: 'PDF upload, parsing, chunking, embedding, and Pinecone storage', targetDate: new Date(Date.now() + 21*24*60*60*1000) },
  { name: 'Session-based Chat & Prompt Assembly', description: 'Conversational interface with session memory and context management', targetDate: new Date(Date.now() + 28*24*60*60*1000) },
  { name: 'Evaluation & Confidence System', description: 'Inline evaluation with heuristics, LLM judge, and fail-safe logic', targetDate: new Date(Date.now() + 35*24*60*60*1000) },
  { name: 'Dashboard & Analytics', description: 'Query analytics, performance metrics, and admin interface', targetDate: new Date(Date.now() + 42*24*60*60*1000) },
  { name: 'Security, RLS & Purge', description: 'Row-level security and data purge capabilities', targetDate: new Date(Date.now() + 42*24*60*60*1000) },
  { name: 'Deployment & Observability', description: 'Production deployment with monitoring and structured logging', targetDate: new Date(Date.now() + 42*24*60*60*1000) }
];

async function run() {
  console.log('📋 Creating epics as project milestones...');
  const mutation = `
    mutation CreateProjectMilestone($input: ProjectMilestoneCreateInput!) {
      projectMilestoneCreate(input: $input) {
        success
        projectMilestone { id name }
      }
    }
  `;
  const created = [];
  for (const epic of EPICS) {
    const input = {
      name: epic.name,
      description: epic.description,
      targetDate: epic.targetDate.toISOString(),
      projectId: projectInfo.projectId
    };
    try {
      const res = await linearQuery(mutation, { input });
      if (res && res.projectMilestoneCreate && res.projectMilestoneCreate.success) {
        created.push(epic.name);
        console.log(`✅ Created epic: ${epic.name}`);
      } else {
        console.log(`⚠️  Skipped epic: ${epic.name}`);
      }
    } catch (e) {
      console.log(`⚠️  Error creating epic ${epic.name}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`\n🎉 Milestones created: ${created.length}/${EPICS.length}`);
}

run().catch(e => { console.error('❌ Failed:', e.message); process.exit(1); });

