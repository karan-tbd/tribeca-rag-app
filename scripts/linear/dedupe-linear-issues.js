#!/usr/bin/env node

/**
 * Dedupe Linear issues in a project by title.
 * Keeps the earliest created issue for each title, cancels the rest.
 *
 * Usage: node dedupe-linear-issues.js <LINEAR_API_TOKEN> <PROJECT_ID>
 */

const https = require('https');

const TOKEN = process.argv[2];
const PROJECT_ID = process.argv[3];
if (!TOKEN || !PROJECT_ID) {
  console.error('Usage: node dedupe-linear-issues.js <LINEAR_API_TOKEN> <PROJECT_ID>');
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
        'Content-Length': body.length,
      },
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

(async () => {
  console.log('🔎 Loading project, team and states...');
  const proj = await gql(`
    query($id:String!){
      project(id:$id){ id name teams{ nodes{ id name states { nodes { id name type } } } }
        issues(first: 250) { nodes { id title identifier url createdAt } }
      }
    }
  `, { id: PROJECT_ID });

  const project = proj.project;
  if (!project) { throw new Error('Project not found'); }
  const team = project.teams.nodes[0];
  if (!team) { throw new Error('Team not found for project'); }

  const states = (team.states && team.states.nodes) || [];
  let canceled = states.find(s => (s.type || '').toLowerCase() === 'canceled')
    || states.find(s => /cancel+ed/i.test(s.name || ''))
    || states[states.length - 1];
  if (!canceled) throw new Error('No workflow state found');
  console.log(`✅ Using cancel state: ${canceled.name}`);

  const issues = (project.issues && project.issues.nodes) || [];
  console.log(`📋 Found ${issues.length} issues in project`);

  // Group by normalized title
  const groups = new Map();
  for (const it of issues) {
    const key = (it.title || '').trim().toLowerCase();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }

  const toCancel = [];
  for (const [title, arr] of groups) {
    if (arr.length <= 1) continue;
    // keep earliest createdAt
    arr.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
    const keep = arr[0];
    const dups = arr.slice(1);
    dups.forEach(d => toCancel.push({ keep, dup: d }));
  }

  console.log(`♻️  Duplicates to cancel: ${toCancel.length}`);
  const mutation = `
    mutation($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue { id identifier title url }
      }
    }
  `;

  let ok = 0, fail = 0;
  for (const { keep, dup } of toCancel) {
    try {
      const res = await gql(mutation, { id: dup.id, input: { stateId: canceled.id } });
      if (res && res.issueUpdate && res.issueUpdate.success) {
        ok++;
        console.log(`✅ Canceled duplicate ${dup.identifier} (kept ${keep.identifier})`);
      } else {
        fail++;
        console.log(`⚠️  Failed to cancel ${dup.identifier}`);
      }
    } catch (e) {
      fail++;
      console.log(`⚠️  Error canceling ${dup.identifier}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n🎯 Dedupe complete: canceled=${ok}, failed=${fail}`);
})().catch(e => { console.error('❌ Dedupe failed:', e.message); process.exit(1); });

