#!/usr/bin/env node

/**
 * Assign issues to project milestones (epics) and wire dependencies.
 * Usage: node assign-epics-and-deps.js <LINEAR_API_TOKEN> <PROJECT_ID>
 */

const https = require('https');

const TOKEN = process.argv[2];
const PROJECT_ID = process.argv[3];
if (!TOKEN || !PROJECT_ID) {
  console.error('Usage: node assign-epics-and-deps.js <LINEAR_API_TOKEN> <PROJECT_ID>');
  process.exit(1);
}

function gql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const req = https.request({
      hostname: 'api.linear.app',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${TOKEN}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}');
          if (json.errors) return reject(new Error(`GraphQL Error: ${JSON.stringify(json.errors)}`));
          resolve(json.data);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Minimal definitions matching create-linear-issues.js
const DEFINITIONS = [
  { title: 'Google Sign-In Integration', epic: 'Authentication & User Management', deps: [] },
  { title: 'Row-Level Security Setup', epic: 'Authentication & User Management', deps: ['Google Sign-In Integration'] },
  { title: 'Agent Configuration UI', epic: 'Agent Configuration', deps: ['Google Sign-In Integration'] },
  { title: 'Agent Persistence Layer', epic: 'Agent Configuration', deps: ['Row-Level Security Setup'] },
  { title: 'PDF Upload Interface', epic: 'Document Ingestion & Indexing', deps: ['Agent Configuration UI'] },
  { title: 'PDF Processing Pipeline', epic: 'Document Ingestion & Indexing', deps: ['Agent Persistence Layer'] },
  { title: 'Vector Storage Integration', epic: 'Document Ingestion & Indexing', deps: ['PDF Processing Pipeline'] },
];

(async () => {
  console.log('🔎 Loading project milestones and issues...');
  const proj = await gql(`
    query($id:String!){
      project(id:$id){
        id name
        projectMilestones(first: 100){ nodes { id name } }
        issues(first: 250){ nodes { id title identifier url projectMilestone { id name } } }
      }
    }
  `, { id: PROJECT_ID });

  const project = proj.project;
  if (!project) throw new Error('Project not found');

  const milestoneByName = new Map();
  for (const m of (project.projectMilestones?.nodes || [])) {
    milestoneByName.set((m.name || '').trim(), m.id);
  }

  const issuesByTitle = new Map();
  for (const it of (project.issues?.nodes || [])) {
    issuesByTitle.set((it.title || '').trim(), it);
  }

  // Assign milestones
  console.log('\n📌 Assigning epics (project milestones)...');
  const updateMutation = `
    mutation($id:String!, $input: IssueUpdateInput!) {
      issueUpdate(id:$id, input:$input) { success issue { id identifier title projectMilestone { id name } } }
    }
  `;

  let assigned = 0, skipped = 0;
  for (const def of DEFINITIONS) {
    const issue = issuesByTitle.get(def.title);
    if (!issue) { console.log(`⚠️  Issue not found by title: ${def.title}`); continue; }
    const msId = milestoneByName.get(def.epic);
    if (!msId) { console.log(`⚠️  Milestone not found: ${def.epic}`); continue; }
    const already = issue.projectMilestone && issue.projectMilestone.id === msId;
    if (already) { skipped++; continue; }
    try {
      const res = await gql(updateMutation, { id: issue.id, input: { projectMilestoneId: msId } });
      if (res?.issueUpdate?.success) {
        assigned++;
        console.log(`✅ ${issue.identifier} → ${def.epic}`);
      } else {
        console.log(`❌ Failed to assign ${issue.identifier} to ${def.epic}`);
      }
    } catch (e) {
      console.log(`⚠️  Error assigning ${issue.identifier}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`➡️  Milestone assignment complete. changed=${assigned}, skipped=${skipped}`);

  // Wire dependencies
  console.log('\n⛓️  Wiring dependencies...');
  const relationMutation = `
    mutation($input: IssueRelationCreateInput!) {
      issueRelationCreate(input: $input) { success issueRelation { id type issue { identifier } relatedIssue { identifier } } }
    }
  `;

  let created = 0, relSkipped = 0;
  for (const def of DEFINITIONS) {
    const current = issuesByTitle.get(def.title);
    if (!current) continue;
    for (const depTitle of def.deps) {
      const dep = issuesByTitle.get(depTitle);
      if (!dep) { console.log(`⚠️  Dependency not found: ${depTitle}`); continue; }
      try {
        // Create relation where dep blocks current
        const res = await gql(relationMutation, { input: { type: 'blocks', issueId: dep.id, relatedIssueId: current.id } });
        if (res?.issueRelationCreate?.success) {
          created++;
          console.log(`🔗 ${dep.identifier} blocks ${current.identifier}`);
        } else {
          relSkipped++;
          console.log(`⚠️  Failed relation: ${dep.identifier} -> ${current.identifier}`);
        }
      } catch (e) {
        // Likely duplicate relation; log and continue
        relSkipped++;
        console.log(`↩️  Relation exists or error for ${dep.identifier} -> ${current.identifier}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }
  console.log(`➡️  Dependency wiring complete. created=${created}, skipped=${relSkipped}`);
})();

