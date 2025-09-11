#!/usr/bin/env node

/**
 * Populate all issues (RAG-1..RAG-19), assign to epics, add labels, auto-assign to viewer, and wire dependencies.
 * Usage: node populate-all-issues.js <LINEAR_API_TOKEN> <PROJECT_ID>
 */

const https = require('https');

const TOKEN = process.argv[2];
const PROJECT_ID = process.argv[3];
if (!TOKEN || !PROJECT_ID) {
  console.error('Usage: node populate-all-issues.js <LINEAR_API_TOKEN> <PROJECT_ID>');
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

// Helper: small sleep
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Definitions derived from linear-issues-detailed.md
const DEFINITIONS = [
  { title: 'Google Sign-In Integration', epic: 'Authentication & User Management', labels: ['backend','auth'], estimate: 3, priority: 1, deps: [] },
  { title: 'Row-Level Security Setup', epic: 'Authentication & User Management', labels: ['backend','auth','security'], estimate: 5, priority: 1, deps: ['Google Sign-In Integration'] },
  { title: 'Agent Configuration UI', epic: 'Agent Configuration', labels: ['frontend'], estimate: 5, priority: 1, deps: ['Google Sign-In Integration'] },
  { title: 'Agent Persistence Layer', epic: 'Agent Configuration', labels: ['backend'], estimate: 3, priority: 1, deps: ['Row-Level Security Setup'] },
  { title: 'PDF Upload Interface', epic: 'Document Ingestion & Indexing', labels: ['frontend'], estimate: 3, priority: 1, deps: ['Agent Configuration UI'] },
  { title: 'PDF Processing Pipeline', epic: 'Document Ingestion & Indexing', labels: ['backend','retrieval'], estimate: 8, priority: 1, deps: ['Agent Persistence Layer'] },
  { title: 'Vector Storage Integration', epic: 'Document Ingestion & Indexing', labels: ['backend','infra'], estimate: 5, priority: 1, deps: ['PDF Processing Pipeline'] },
  { title: 'Session Management', epic: 'Session-based Chat & Prompt Assembly', labels: ['backend'], estimate: 5, priority: 1, deps: ['Vector Storage Integration'] },
  { title: 'Chat Interface', epic: 'Session-based Chat & Prompt Assembly', labels: ['frontend','sessions'], estimate: 8, priority: 1, deps: ['Session Management'] },
  { title: 'Prompt Assembly Engine', epic: 'Session-based Chat & Prompt Assembly', labels: ['backend','retrieval','sessions'], estimate: 8, priority: 1, deps: ['Session Management','Vector Storage Integration'] },
  { title: 'Heuristic Evaluators', epic: 'Evaluation & Confidence System', labels: ['backend','evals'], estimate: 3, priority: 1, deps: ['Prompt Assembly Engine'] },
  { title: 'LLM Judge Integration', epic: 'Evaluation & Confidence System', labels: ['backend','evals'], estimate: 5, priority: 1, deps: ['Heuristic Evaluators'] },
  { title: 'Confidence Aggregation & Fail-safe', epic: 'Evaluation & Confidence System', labels: ['backend','evals','generation'], estimate: 3, priority: 1, deps: ['LLM Judge Integration'] },
  { title: 'Analytics Data Collection', epic: 'Dashboard & Analytics', labels: ['backend','observability'], estimate: 3, priority: 1, deps: ['Confidence Aggregation & Fail-safe'] },
  { title: 'Dashboard UI', epic: 'Dashboard & Analytics', labels: ['frontend','observability'], estimate: 5, priority: 1, deps: ['Analytics Data Collection'] },
  { title: 'Data Purge System', epic: 'Security, RLS & Purge', labels: ['backend','security'], estimate: 3, priority: 1, deps: ['Row-Level Security Setup'] },
  { title: 'Production Deployment', epic: 'Deployment & Observability', labels: ['infra'], estimate: 5, priority: 1, deps: ['Dashboard UI'] },
  { title: 'Structured Logging & Tracing', epic: 'Deployment & Observability', labels: ['backend','observability','infra'], estimate: 3, priority: 1, deps: ['Production Deployment'] },
  { title: 'CI/CD Pipeline', epic: 'Deployment & Observability', labels: ['infra'], estimate: 3, priority: 1, deps: ['Production Deployment'] },
];

(async () => {
  console.log('🔎 Loading viewer, project, team, labels, milestones, and existing issues...');
  const bootstrap = await gql(`
    query($projectId:String!){
      viewer { id name email }
      project(id:$projectId){ id name teams { nodes { id name } } projectMilestones(first:100){ nodes{ id name } } issues(first:250){ nodes{ id title identifier url } } }
    }
  `, { projectId: PROJECT_ID });
  const viewer = bootstrap.viewer;
  const project = bootstrap.project;
  const teamId = project.teams.nodes[0].id;
  const milestoneByName = new Map((project.projectMilestones.nodes||[]).map(m=>[m.name,m.id]));
  const existingByTitle = new Map((project.issues.nodes||[]).map(i=>[(i.title||'').trim().toLowerCase(), i]));

  // fetch labels from team
  const lblData = await gql(`query($id:String!){ team(id:$id){ id name labels(first:200){ nodes{ id name } } } }`, { id: teamId });
  const labelsNodes = (lblData && lblData.team && lblData.team.labels && lblData.team.labels.nodes) || [];
  const labelByName = new Map(labelsNodes.map(l=>[l.name.toLowerCase(), l.id]));

  console.log(`✅ Viewer: ${viewer.name}  | Team: ${project.teams.nodes[0].name}`);

  // Ensure labels exist (best effort; create missing)
  const ensureLabel = async (name) => {
    const key = name.toLowerCase();
    if (labelByName.has(key)) return labelByName.get(key);
    try {
      const res = await gql(`mutation($input: LabelCreateInput!){ labelCreate(input:$input){ success label{ id name } } }`, { input: { name } });
      if (res?.labelCreate?.success) {
        const id = res.labelCreate.label.id; labelByName.set(key, id); return id;
      }
    } catch (e) { /* ignore */ }
    return null;
  };

  // Create or update issues
  console.log('\n🧩 Creating/Updating issues with labels, epic assignment, and assignee...');
  const createdOrFound = new Map();
  for (const def of DEFINITIONS) {
    const titleKey = def.title.trim().toLowerCase();
    let issue = existingByTitle.get(titleKey);

    if (!issue) {
      // Create
      const createRes = await gql(`
        mutation($input: IssueCreateInput!){ issueCreate(input:$input){ success issue{ id identifier title url } } }
      `, { input: {
        title: def.title,
        description: def.title,
        teamId,
        projectId: PROJECT_ID,
        assigneeId: viewer.id,
        estimate: def.estimate,
        priority: def.priority
      }});
      if (createRes?.issueCreate?.success) {
        issue = createRes.issueCreate.issue;
        console.log(`✅ Created ${issue.identifier} - ${def.title}`);
      } else {
        console.log(`⚠️  Failed to create: ${def.title}`);
        continue;
      }
      await sleep(100);
    } else {
      // Ensure assignee/estimate/priority updated
      await gql(`mutation($id:String!,$input:IssueUpdateInput!){ issueUpdate(id:$id,input:$input){ success issue{ id identifier } } }`,
        { id: issue.id, input: { assigneeId: viewer.id, estimate: def.estimate, priority: def.priority } });
      console.log(`⏭️  Exists: ${issue.identifier || ''} - ${def.title}`);
    }

    createdOrFound.set(def.title, issue);

    // Assign epic (project milestone)
    const msId = milestoneByName.get(def.epic);
    if (msId) {
      await gql(`mutation($id:String!,$input:IssueUpdateInput!){ issueUpdate(id:$id,input:$input){ success issue{ id } } }`,
        { id: issue.id, input: { projectMilestoneId: msId } });
    }

    // Assign labels
    for (const lbl of (def.labels || [])) {
      const lid = await ensureLabel(lbl);
      if (!lid) continue;
      try {
        await gql(`mutation($input: IssueLabelCreateInput!){ issueLabelCreate(input:$input){ success issueLabel{ id } } }`,
          { input: { issueId: issue.id, labelId: lid } });
      } catch (e) {
        // likely already attached
      }
      await sleep(50);
    }
  }

  // Wire dependencies
  console.log('\n⛓️  Wiring dependencies...');
  for (const def of DEFINITIONS) {
    const current = createdOrFound.get(def.title);
    if (!current) continue;
    for (const depTitle of (def.deps || [])) {
      const dep = createdOrFound.get(depTitle) || existingByTitle.get(depTitle.trim().toLowerCase());
      if (!dep) { console.log(`⚠️  Missing dependency in project: ${depTitle}`); continue; }
      try {
        await gql(`mutation($input: IssueRelationCreateInput!){ issueRelationCreate(input:$input){ success issueRelation{ id } } }`,
          { input: { type: 'blocks', issueId: dep.id, relatedIssueId: current.id } });
        console.log(`🔗 ${dep.identifier || dep.title} blocks ${current.identifier || current.title}`);
      } catch (e) {
        // likely exists already
      }
      await sleep(50);
    }
  }

  console.log('\n🎉 Population complete. All issues ensured, labeled, assigned, and dependencies wired.');
})();

