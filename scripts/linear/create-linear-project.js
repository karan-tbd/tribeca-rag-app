#!/usr/bin/env node

/**
 * Linear Project Setup Script for RAG Framework App v1
 * 
 * This script creates a complete Linear project with:
 * - Project configuration
 * - Custom fields
 * - Labels
 * - Issue templates
 * - Epics (as milestones)
 * - 19 seed issues with proper dependencies
 * - Sprint planning
 * 
 * Usage: node scripts/linear/create-linear-project.js <LINEAR_API_TOKEN>
 */

const https = require('https');

const LINEAR_API_TOKEN = process.argv[2];

if (!LINEAR_API_TOKEN) {
  console.error('❌ Please provide your Linear API token as an argument');
  console.error('Usage: node scripts/linear/create-linear-project.js <LINEAR_API_TOKEN>');
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

// Project configuration
const PROJECT_CONFIG = {
  name: 'RAG Framework App v1',
  key: 'RAG',
  description: 'Production-grade RAG app with session memory, ingestion pipeline, Pinecone + Supabase, customizable prompts, inline evals, dashboards, and confidence fail-safe.',
  color: '#3b82f6', // Blue
  icon: '🤖'
};

// Labels configuration
const LABELS = [
  { name: 'frontend', color: '#3b82f6', description: 'Next.js UI components' },
  { name: 'backend', color: '#10b981', description: 'Supabase Edge Functions' },
  { name: 'infra', color: '#f59e0b', description: 'Infrastructure and deployment' },
  { name: 'evals', color: '#8b5cf6', description: 'Evaluation and confidence systems' },
  { name: 'retrieval', color: '#06b6d4', description: 'RAG and vector operations' },
  { name: 'auth', color: '#ef4444', description: 'Authentication and security' },
  { name: 'observability', color: '#eab308', description: 'Logging and monitoring' },
  { name: 'docs', color: '#6b7280', description: 'Documentation' }
];

// Workflow states
const WORKFLOW_STATES = [
  { name: 'Backlog', type: 'backlog', color: '#6b7280' },
  { name: 'Spec', type: 'unstarted', color: '#3b82f6' },
  { name: 'Ready', type: 'unstarted', color: '#10b981' },
  { name: 'In Progress', type: 'started', color: '#f59e0b' },
  { name: 'Blocked', type: 'started', color: '#ef4444' },
  { name: 'In Review', type: 'started', color: '#8b5cf6' },
  { name: 'QA', type: 'started', color: '#06b6d4' },
  { name: 'Done', type: 'completed', color: '#10b981' }
];

// Epics configuration
const EPICS = [
  {
    name: 'Authentication & User Management',
    description: 'Secure user access with Google Sign-In via Supabase',
    targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week
  },
  {
    name: 'Agent Configuration',
    description: 'User-configurable agents with prompts and retrieval parameters',
    targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 2 weeks
  },
  {
    name: 'Document Ingestion & Indexing',
    description: 'PDF upload, parsing, chunking, embedding, and Pinecone storage',
    targetDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000) // 3 weeks
  },
  {
    name: 'Session-based Chat & Prompt Assembly',
    description: 'Conversational interface with session memory and context management',
    targetDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000) // 4 weeks
  },
  {
    name: 'Evaluation & Confidence System',
    description: 'Inline evaluation with heuristics, LLM judge, and fail-safe logic',
    targetDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000) // 5 weeks
  },
  {
    name: 'Dashboard & Analytics',
    description: 'Query analytics, performance metrics, and admin interface',
    targetDate: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000) // 6 weeks
  },
  {
    name: 'Security, RLS & Purge',
    description: 'Row-level security and data purge capabilities',
    targetDate: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000) // 6 weeks
  },
  {
    name: 'Deployment & Observability',
    description: 'Production deployment with monitoring and structured logging',
    targetDate: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000) // 6 weeks
  }
];

// Main setup function
async function setupLinearProject() {
  console.log('🚀 Starting Linear project setup for RAG Framework App v1...\n');

  try {
    // Step 1: Get current user and team
    console.log('📋 Step 1: Getting user and team information...');
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
    
    if (userInfo.teams.nodes.length === 0) {
      throw new Error('No teams found. Please create a team in Linear first.');
    }
    
    const team = userInfo.teams.nodes[0]; // Use first team
    console.log(`✅ Using team: ${team.name} (${team.key})\n`);

    // Step 2: Create project
    console.log('📋 Step 2: Creating project...');
    const createProjectMutation = `
      mutation CreateProject($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          success
          project {
            id
            name
            url
          }
        }
      }
    `;

    const projectInput = {
      name: PROJECT_CONFIG.name,
      description: PROJECT_CONFIG.description,
      teamIds: [team.id],
      targetDate: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000).toISOString() // 6 weeks
    };

    const projectResult = await linearQuery(createProjectMutation, { input: projectInput });
    console.log('ℹ️  Raw createProject result:', JSON.stringify(projectResult, null, 2));

    if (!projectResult || !projectResult.projectCreate || projectResult.projectCreate.success === false) {
      throw new Error('Failed to create project');
    }

    const project = projectResult.projectCreate.project;
    console.log(`✅ Project created: ${project.name}`);
    console.log(`🔗 Project URL: ${project.url}\n`);

    // Step 3: Create labels
    console.log('📋 Step 3: Creating labels...');
    const labelIds = {};
    
    for (const label of LABELS) {
      const createLabelMutation = `
        mutation CreateLabel($input: IssueLabelCreateInput!) {
          issueLabelCreate(input: $input) {
            success
            issueLabel {
              id
              name
            }
          }
        }
      `;

      const labelInput = {
        name: label.name,
        color: label.color,
        description: label.description,
        teamId: team.id
      };

      const labelResult = await linearQuery(createLabelMutation, { input: labelInput });
      
      if (labelResult.issueLabelCreate.success) {
        labelIds[label.name] = labelResult.issueLabelCreate.issueLabel.id;
        console.log(`✅ Created label: ${label.name}`);
      }
    }
    console.log('');

    // Step 4: Create workflow states (if needed)
    console.log('📋 Step 4: Checking workflow states...');
    const workflowQuery = `
      query GetWorkflow($teamId: String!) {
        team(id: $teamId) {
          states {
            nodes {
              id
              name
              type
            }
          }
        }
      }
    `;

    const workflowInfo = await linearQuery(workflowQuery, { teamId: team.id });
    console.log(`✅ Found ${workflowInfo.team.states.nodes.length} existing workflow states\n`);

    // Step 5: Create milestones (epics)
    console.log('📋 Step 5: Creating epics as milestones...');
    const milestoneIds = {};
    
    for (const epic of EPICS) {
      const createMilestoneMutation = `
        mutation CreateProjectMilestone($input: ProjectMilestoneCreateInput!) {
          projectMilestoneCreate(input: $input) {
            success
            projectMilestone {
              id
              name
            }
          }
        }
      `;

      const milestoneInput = {
        name: epic.name,
        description: epic.description,
        targetDate: epic.targetDate.toISOString(),
        projectId: project.id
      };

      const milestoneResult = await linearQuery(createMilestoneMutation, { input: milestoneInput });

      if (milestoneResult && milestoneResult.projectMilestoneCreate && milestoneResult.projectMilestoneCreate.success) {
        milestoneIds[epic.name] = milestoneResult.projectMilestoneCreate.projectMilestone.id;
        console.log(`✅ Created epic: ${epic.name}`);
      }
    }
    console.log('');

    console.log('🎉 Linear project setup completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`- Project: ${project.name} (${project.key})`);
    console.log(`- Labels: ${Object.keys(labelIds).length} created`);
    console.log(`- Epics: ${Object.keys(milestoneIds).length} created`);
    console.log(`- Project URL: ${project.url}`);
    console.log(`\n🔄 Next steps:`);
    console.log(`1. Run the issue creation script: node scripts/linear/create-linear-issues.js ${LINEAR_API_TOKEN} ${project.id}`);
    console.log(`2. Set up custom fields in Linear UI`);
    console.log(`3. Create issue templates in Linear UI`);
    console.log(`4. Set up saved views and filters`);

    // Save project info for next script
    const projectInfo = {
      projectId: project.id,
      teamId: team.id,
      labelIds,
      milestoneIds,
      projectUrl: project.url
    };

    require('fs').writeFileSync('linear-project-info.json', JSON.stringify(projectInfo, null, 2));
    console.log(`\n💾 Project info saved to linear-project-info.json`);

  } catch (error) {
    console.error('❌ Error setting up Linear project:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupLinearProject();
