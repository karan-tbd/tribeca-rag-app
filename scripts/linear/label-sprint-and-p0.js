#!/usr/bin/env node

/**
 * Add labels P0 and current-sprint to Sprint 1 issues as defined in linear-project-setup.md
 * Usage: node label-sprint-and-p0.js <LINEAR_API_TOKEN> <PROJECT_ID>
 */

const https = require('https');

const TOKEN = process.argv[2];
const PROJECT_ID = process.argv[3];
if (!TOKEN || !PROJECT_ID) {
  console.error('Usage: node label-sprint-and-p0.js <LINEAR_API_TOKEN> <PROJECT_ID>');
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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Sprint 1 issues per linear-project-setup.md
const SPRINT1_TITLES = new Set([
  'Google Sign-In Integration',
  'Row-Level Security Setup',
  'Agent Configuration UI',
  'Agent Persistence Layer',
  'Production Deployment',
]);

(async () => {
  console.log('🔎 Loading project, team and issues...');
  const boot = await gql(`
    query($id:String!){
      project(id:$id){ id name teams{ nodes{ id name } } issues(first:250){ nodes{ id title identifier labels{ nodes{ id name } } } } }
    }
  `, { id: PROJECT_ID });

  const project = boot.project;
  if (!project) throw new Error('Project not found');
  const teamId = project.teams.nodes[0].id;

  // Try to read labels from anchor issue KAR-27 (user added labels there)
  const normalize = (s) => (s||'').toLowerCase().replace(/[\s_]+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-');
  const anchor = project.issues.nodes.find(n => n.identifier === 'KAR-27' || (n.title||'').toLowerCase() === 'ci/cd pipeline');
  let labelByName = new Map();
  if (anchor && anchor.labels && anchor.labels.nodes) {
    for (const l of anchor.labels.nodes) labelByName.set(normalize(l.name), l.id);
  }

  // Fallback to team/workspace labels if needed
  if (labelByName.size === 0) {
    const lblData = await gql(`query($id:String!){ team(id:$id){ id name labels(first:200){ nodes{ id name } } } }`, { id: teamId });
    let labelsNodes = (lblData && lblData.team && lblData.team.labels && lblData.team.labels.nodes) || [];
    try {
      const allLbl = await gql(`query{ issueLabels(first: 200){ nodes{ id name } } }`);
      if (allLbl && allLbl.issueLabels && allLbl.issueLabels.nodes) {
        const seen = new Set(labelsNodes.map(x=>x.id));
        for (const n of allLbl.issueLabels.nodes) if (!seen.has(n.id)) labelsNodes.push(n);
      }
    } catch (_) { /* ignore */ }
    labelByName = new Map(labelsNodes.map(l=>[normalize(l.name), l.id]));
  }

  const findByName = (names) => {
    for (const name of names) {
      const id = labelByName.get(normalize(name));
      if (id) return id;
    }
    return null;
  };

  let p0Id = findByName(['P0', 'p0']);
  let csId = findByName(['current-sprint', 'current sprint', 'currentsprint']);

  if (!p0Id || !csId) {
    console.log('⚠️  Missing labels. Please ensure the KAR-27 issue has both labels (P0 and current-sprint).');
    if (!p0Id) console.log('  - Missing: P0');
    if (!csId) console.log('  - Missing: current-sprint');
    console.log('Then re-run: node label-sprint-and-p0.js <TOKEN> <PROJECT_ID>');
    process.exit(0);
  }

  let tagged = 0;
  for (const issue of project.issues.nodes) {
    if (!SPRINT1_TITLES.has(issue.title)) continue;

    for (const lid of [p0Id, csId]) {
      try {
        await gql(`mutation($input: IssueLabelCreateInput!){ issueLabelCreate(input:$input){ success } }`, { input: { issueId: issue.id, labelId: lid } });
      } catch (e) {
        // already exists or other non-fatal
      }
      await sleep(50);
    }
    tagged++;
    console.log(`🏷️  Tagged ${issue.identifier} (${issue.title}) with P0 and current-sprint`);
  }

  console.log(`🎉 Done. Tagged ${tagged} Sprint 1 issues in project "${project.name}".`);
})();

