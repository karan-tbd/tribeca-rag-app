#!/usr/bin/env node

/**
 * Linear Project Synchronization Script — updated-linear-setup
 *
 * Safely syncs the "RAG Framework App v1" Linear project to match docs/linear/updated-linear-setup
 * - Update existing issues (RAG-1..RAG-19) in-place (no duplicates)
 * - Create new issues (RAG-20..RAG-23)
 * - Assign epics (as project milestones) and labels
 * - Prepare sprint assignments (cycles) if available
 * - Update custom fields (Component, Estimate, Risk, Acceptance) when resolvable
 *
 * Usage:
 *   LINEAR_API_TOKEN=xxxxx node scripts/linear/sync-updated-linear-setup.cjs --project-id=9ff76161-bb4d-44f2-bea8-98d0f4da29b5 [--apply]
 *
 * Defaults to DRY RUN (no mutations). Pass --apply to perform updates.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// CLI args
const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
  const pref = `--${name}=`;
  const found = args.find(a => a.startsWith(pref));
  if (found) return found.substring(pref.length);
  return fallback;
};

const TOKEN = process.env.LINEAR_API_TOKEN || getArg('token', null);
const PROJECT_ID = getArg('project-id', null);
const APPLY = args.includes('--apply');

if (!PROJECT_ID) {
  console.error('❌ Missing --project-id.');
  process.exit(1);
}
if (!TOKEN) {
  console.error('❌ Missing LINEAR_API_TOKEN env or --token=...');
  process.exit(1);
}

const SPEC_PATH = path.join(process.cwd(), 'docs/linear/updated-linear-setup');
let SPEC;
try {
  SPEC = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
} catch (e) {
  console.error(`❌ Failed to read spec at ${SPEC_PATH}:`, e.message);
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

(async () => {
  const report = {
    dryRun: !APPLY,
    projectId: PROJECT_ID,
    discovery: {},
    changes: { updates: [], creations: [], sprints: [] },
    warnings: [],
    errors: []
  };

  console.log(`🔎 Discovery → Project ${PROJECT_ID}`);
  const boot = await gql(`
    query($id:String!){
      project(id:$id){
        id name url
        teams { nodes { id name } }
        projectMilestones(first:100){ nodes { id name } }
        issues(first:250){ nodes { id identifier title url labels{nodes{id name}} projectMilestone{ id name } } }
      }
    }
  `, { id: PROJECT_ID });

  const project = boot?.project;
  if (!project) throw new Error('Project not found or inaccessible');
  const team = project.teams?.nodes?.[0];
  if (!team) throw new Error('Team not found for project');

  report.discovery.project = { id: project.id, name: project.name, url: project.url };
  report.discovery.team = { id: team.id, name: team.name };

  // Labels: load team + global to resolve IDs
  const lblData = await gql(`query($id:String!){ team(id:$id){ id name labels(first:200){ nodes{ id name } } } issueLabels(first:200){ nodes{ id name } } }`, { id: team.id });
  const teamLabels = lblData?.team?.labels?.nodes || [];
  const globalLabels = lblData?.issueLabels?.nodes || [];
  const labelByLower = new Map([...teamLabels, ...globalLabels].map(l => [String(l.name||'').toLowerCase(), l.id]));

  // Ensure labels listed in SPEC.project.labels exist (best-effort)
  async function ensureLabel(name) {
    const key = String(name||'').toLowerCase();
    if (labelByLower.has(key)) return labelByLower.get(key);
    if (!APPLY) { report.warnings.push(`Will create missing label: ${name}`); return null; }
    try {
      const res = await gql(`mutation($input: IssueLabelCreateInput!){ issueLabelCreate(input:$input){ success issueLabel{ id name } } }`, { input: { name, teamId: team.id } });
      if (res?.issueLabelCreate?.success) {
        const id = res.issueLabelCreate.issueLabel.id; labelByLower.set(key, id); return id;
      }
    } catch (e) { report.warnings.push(`Label create failed for ${name}: ${e.message}`); }
    return null;
  }

  for (const lbl of (SPEC?.project?.labels||[])) await ensureLabel(lbl);

  // Map epics (project milestones)
  const milestoneByName = new Map((project.projectMilestones?.nodes||[]).map(m => [String(m.name||'').trim(), m.id]));

  // Fetch custom fields (best-effort; schema may vary)
  let customFieldDefs = [];
  try {
    const cfQ = await gql(`query($id:String!){ team(id:$id){ id name customFields(first:100){ nodes{ id name dataType options{ id name } } } } }`, { id: team.id });
    customFieldDefs = cfQ?.team?.customFields?.nodes || [];
  } catch (_) {
    try {
      // Fallback: some APIs expose "type" instead of "dataType"
      const cfQ2 = await gql(`query($id:String!){ team(id:$id){ id name customFields(first:100){ nodes{ id name type options{ id name } } } } }`, { id: team.id });
      customFieldDefs = cfQ2?.team?.customFields?.nodes || [];
    } catch (e2) {
      report.warnings.push('Could not fetch custom field definitions. Custom fields will be logged but may not be updated automatically.');
    }
  }
  const cfByName = new Map(customFieldDefs.map(cf => [String(cf.name||'').trim(), cf]));

  // Index existing issues by identifier and by title
  const existingIssues = project.issues?.nodes || [];
  const byIdentifier = new Map(existingIssues.map(x => [x.identifier, x]));
  const byTitleLower = new Map(existingIssues.map(x => [String(x.title||'').trim().toLowerCase(), x]));

  // Legacy title mapping from earlier seeds/automation
  const LEGACY_TITLE_BY_KEY = new Map([
    ['RAG-1', ['Google Sign-In Integration']],
    ['RAG-2', ['Row-Level Security Setup']],
    ['RAG-3', ['Agent Configuration UI']],
    ['RAG-4', ['Agent Persistence Layer']],
    ['RAG-5', ['PDF Upload Interface']],
    ['RAG-6', ['PDF Processing Pipeline']],
    ['RAG-7', ['Vector Storage Integration']],
    ['RAG-8', ['Session Management']],
    ['RAG-9', ['Chat Interface']],
    ['RAG-10', ['Prompt Assembly Engine']],
    ['RAG-11', ['Heuristic Evaluators']],
    ['RAG-12', ['LLM Judge Integration']],
    ['RAG-13', ['Confidence Aggregation & Fail-safe']],
    ['RAG-14', ['Analytics Data Collection']],
    ['RAG-15', ['Dashboard UI']],
    ['RAG-16', ['Data Purge System']],
    ['RAG-17', ['Production Deployment']],
    ['RAG-18', ['Structured Logging & Tracing']],
    ['RAG-19', ['CI/CD Pipeline']],
  ]);

  function resolveExistingIssue(key, targetTitle) {
    let ex = byIdentifier.get(key);
    if (ex) return ex;
    if (targetTitle) {
      const t = String(targetTitle).trim().toLowerCase();
      ex = byTitleLower.get(t);
      if (ex) return ex;
    }
    const legacy = LEGACY_TITLE_BY_KEY.get(key) || [];
    for (const name of legacy) {
      const ex2 = byTitleLower.get(String(name).trim().toLowerCase());
      if (ex2) return ex2;
    }
    return null;
  }

  // Helper: map spec CF values → { customFieldId, optionId/value }
  function buildCustomFieldUpdates(specCF) {
    if (!specCF) return [];
    const updates = [];
    for (const [name, val] of Object.entries(specCF)) {
      const def = cfByName.get(name);
      if (!def) { report.warnings.push(`Custom field not found: ${name}`); continue; }
      const entry = { customFieldId: def.id };
      const type = String(def.dataType || def.type || '').toLowerCase();
      if ((type === 'singleselect' || type === 'select' || type === 'enum' || type === 'selectenum')) {
        const opt = (def.options||[]).find(o => String(o.name||'').toLowerCase() === String(val||'').toLowerCase());
        if (!opt) { report.warnings.push(`Option not found for ${name}: ${val}`); continue; }
        entry.customFieldOptionId = opt.id;
      } else if (type === 'text' || typeof val === 'string') {
        entry.value = String(val);
      } else {
        entry.value = val;
      }
      updates.push(entry);
    }
    return updates;
  }

  // Prepare sprint mapping (cycles) — best-effort
  let cycles = [];
  try {
    const cyc = await gql(`query($id:String!){ team(id:$id){ id name cycles(first:50){ nodes{ id name number startsAt endsAt } } } }`, { id: team.id });
    cycles = cyc?.team?.cycles?.nodes || [];
  } catch (e) {
    report.warnings.push('Could not query cycles (sprints). Sprint assignment will be logged only.');
  }
  const cycleByName = new Map(cycles.map(c => [String(c.name||'').trim(), c]));

  // Iterate issues in SPEC
  const SPEC_ISSUES = SPEC.issues || [];
  for (const it of SPEC_ISSUES) {
    const key = it.key; // e.g., RAG-1
    const op = it.operation; // update | create
    const title = it.title;
    const labels = it.labels || [];
    const epicKey = it.epic; // e.g., EPIC-1

    // Resolve epic name from spec.epics array
    let epicName = null;
    if (epicKey) {
      const epic = (SPEC.epics || []).find(e => e.key === epicKey);
      epicName = epic?.name || null;
    }

    let existing = resolveExistingIssue(key, title);

    if (op === 'update') {
      if (!existing) { report.warnings.push(`Issue ${key} not found for update by identifier/title. Will skip.`); continue; }

      const change = { key, url: existing.url, changes: {} };

      // Title change
      if (title && title.trim() !== (existing.title||'').trim()) {
        change.changes.title = { from: existing.title, to: title };
      }

      // Epic assignment (project milestone)
      if (epicName && milestoneByName.has(epicName)) {
        const msId = milestoneByName.get(epicName);
        const cur = existing.projectMilestone?.id || null;
        if (cur !== msId) change.changes.projectMilestoneId = { from: cur, to: msId, name: epicName };
      } else if (epicName) {
        report.warnings.push(`Milestone not found for epic ${epicKey} (${epicName}).`);
      }

      // Labels
      const currentLabels = new Set((existing.labels?.nodes||[]).map(l => String(l.name||'').toLowerCase()));
      const addLabelIds = [];
      for (const lbl of labels) {
        if (!currentLabels.has(String(lbl).toLowerCase())) {
          let lid = labelByLower.get(String(lbl).toLowerCase());
          if (!lid) {
            lid = await ensureLabel(lbl);
            if (lid) labelByLower.set(String(lbl).toLowerCase(), lid);
          }
          if (lid) addLabelIds.push(lid);
          else report.warnings.push(`Label missing and could not resolve id for: ${lbl}`);
        }
      }
      if (addLabelIds.length) change.changes.addLabelIds = addLabelIds;

      // Custom fields
      const cfUpdates = buildCustomFieldUpdates(it.custom_fields);
      if (cfUpdates.length) change.changes.customFields = cfUpdates;

      // Apply if needed
      if (Object.keys(change.changes).length) {
        report.changes.updates.push(change);
        if (APPLY) {
          // title & milestone in one update where possible
          const input = {};
          if (change.changes.title) input.title = title;
          if (change.changes.projectMilestoneId) input.projectMilestoneId = change.changes.projectMilestoneId.to;
          if (Object.keys(input).length) {
            await gql(`mutation($id:String!,$input:IssueUpdateInput!){ issueUpdate(id:$id,input:$input){ success } }`, { id: existing.id, input });
            await sleep(80);
          }
          // labels (attach only; ignore existing)
          for (const lid of addLabelIds) {
            try { await gql(`mutation($input: IssueLabelCreateInput!){ issueLabelCreate(input:$input){ success } }`, { input: { issueId: existing.id, labelId: lid } }); } catch (_) {}
            await sleep(50);
          }
          // custom fields (best-effort). Try issueUpdate customFields first; fallback to per-field create
          if (cfUpdates.length) {
            try {
              await gql(`mutation($id:String!,$cfs:[CustomFieldValueUpdateInput!]){ issueUpdate(id:$id,input:{ customFields:$cfs }){ success } }`, { id: existing.id, cfs: cfUpdates });
            } catch (e) {
              report.warnings.push(`Custom field batch update failed for ${key}: ${e.message}`);
              // Fallback: try one-by-one create/update
              for (const cf of cfUpdates) {
                try {
                  await gql(`mutation($input: IssueCustomFieldCreateInput!){ issueCustomFieldCreate(input:$input){ success } }`, { input: { issueId: existing.id, customFieldId: cf.customFieldId, value: cf.value, customFieldOptionId: cf.customFieldOptionId } });
                  await sleep(50);
                } catch (e2) {
                  report.warnings.push(`CF set failed for ${key}/${cf.customFieldId}: ${e2.message}`);
                }
              }
            }
            await sleep(80);
          }
        }
      }
    } else if (op === 'create') {
      // Do not create if already exists by identifier OR by title (defensive)
      const existsByTitle = title ? byTitleLower.get(String(title).toLowerCase()) : null;
      if (existing || existsByTitle) {
        report.warnings.push(`Create skipped for ${key} (${title}) — already exists.`);
        continue;
      }

      const msId = epicName && milestoneByName.get(epicName);
      const createInput = { title, teamId: team.id, projectId: project.id };

      const createChange = { key, title, epic: epicName, labels, url: null };
      report.changes.creations.push(createChange);

      if (APPLY) {
        const res = await gql(`mutation($input: IssueCreateInput!){ issueCreate(input:$input){ success issue{ id identifier url } } }`, { input: createInput });
        if (res?.issueCreate?.success) {
          const newIssue = res.issueCreate.issue;
          createChange.url = newIssue.url;
          // set milestone
          if (msId) await gql(`mutation($id:String!,$input:IssueUpdateInput!){ issueUpdate(id:$id,input:$input){ success } }`, { id: newIssue.id, input: { projectMilestoneId: msId } });
          // add labels
          for (const lbl of labels) {
            let lid = labelByLower.get(String(lbl).toLowerCase());
            if (!lid) {
              lid = await ensureLabel(lbl);
              if (lid) labelByLower.set(String(lbl).toLowerCase(), lid);
            }
            if (!lid) continue;
            try { await gql(`mutation($input: IssueLabelCreateInput!){ issueLabelCreate(input:$input){ success } }`, { input: { issueId: newIssue.id, labelId: lid } }); } catch(_){}
            await sleep(50);
          }
          // custom fields
          const cfUpdates = buildCustomFieldUpdates(it.custom_fields);
          if (cfUpdates.length) {
            try {
              await gql(`mutation($id:String!,$cfs:[CustomFieldValueUpdateInput!]){ issueUpdate(id:$id,input:{ customFields:$cfs }){ success } }`, { id: newIssue.id, cfs: cfUpdates });
            } catch (e) {
              for (const cf of cfUpdates) {
                try { await gql(`mutation($input: IssueCustomFieldCreateInput!){ issueCustomFieldCreate(input:$input){ success } }`, { input: { issueId: newIssue.id, customFieldId: cf.customFieldId, value: cf.value, customFieldOptionId: cf.customFieldOptionId } }); } catch(_){ }
                await sleep(40);
              }
            }
          }
        } else {
          report.errors.push(`Failed to create ${key}: ${title}`);
        }
        await sleep(120);
      }
    }
  }

  // Sprint assignment plan
  if (Array.isArray(SPEC.sprints)) {
    for (const sp of SPEC.sprints) {
      const cycle = cycleByName.get(String(sp.name||'').trim());
      const items = [];
      for (const idKey of (sp.issues||[])) {
        let issue = byIdentifier.get(idKey);
        if (!issue) {
          const specEntry = (SPEC.issues || []).find(x => x.key === idKey);
          const t = specEntry?.title;
          if (t) issue = byTitleLower.get(String(t).trim().toLowerCase());
          if (!issue) {
            const legacy = LEGACY_TITLE_BY_KEY.get(idKey) || [];
            for (const name of legacy) {
              const ex2 = byTitleLower.get(String(name).trim().toLowerCase());
              if (ex2) { issue = ex2; break; }
            }
          }
        }
        if (!issue) { report.warnings.push(`Sprint mapping: issue not found ${idKey}`); continue; }
        items.push({ key: idKey, currentCycle: issue.cycle?.name || null, targetCycle: cycle?.name || null });
        if (APPLY && cycle) {
          try { await gql(`mutation($id:String!,$input:IssueUpdateInput!){ issueUpdate(id:$id,input:$input){ success } }`, { id: issue.id, input: { cycleId: cycle.id } }); } catch (e) { report.warnings.push(`Failed to assign ${idKey} to cycle ${cycle.name}: ${e.message}`); }
          await sleep(60);
        }
      }
      report.changes.sprints.push({ name: sp.name, weeks: sp.weeks, cycleId: cycle?.id || null, items });
    }
  }

  // Output report (JSON)
  const out = JSON.stringify(report, null, 2);
  console.log(`\n===== Linear Sync Report (${APPLY ? 'APPLY' : 'DRY RUN'}) =====\n`);
  console.log(out);

})().catch(err => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});

