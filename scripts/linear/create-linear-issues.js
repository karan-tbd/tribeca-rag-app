#!/usr/bin/env node

/**
 * Linear Issues Creation Script for RAG Framework App v1
 *
 * This script creates all 19 seed issues with proper:
 * - Epic assignments
 * - Labels and priorities
 * - Dependencies
 * - Detailed descriptions and acceptance criteria
 *
 * Usage: node create-linear-issues.js <LINEAR_API_TOKEN> <PROJECT_ID>
 */

const https = require('https');
const fs = require('fs');

const LINEAR_API_TOKEN = process.argv[2];
const PROJECT_ID = process.argv[3];

if (!LINEAR_API_TOKEN || !PROJECT_ID) {
  console.error('❌ Please provide Linear API token and project ID');
  console.error('Usage: node create-linear-issues.js <LINEAR_API_TOKEN> <PROJECT_ID>');
  process.exit(1);
}

// Load project info if available
let projectInfo = {};
try {
  projectInfo = JSON.parse(fs.readFileSync('linear-project-info.json', 'utf8'));
} catch (error) {
  console.log('⚠️  Could not load project info file, will fetch from API');
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

// Issue definitions
const ISSUES = [
  {
    identifier: 'RAG-1',
    title: 'Google Sign-In Integration',
    epic: 'Authentication & User Management',
    priority: 1,
    estimate: 3,
    labels: ['backend', 'auth'],
    description: `## Problem
Users need secure authentication to access the RAG application and manage their personal agents and documents.

## Acceptance Criteria
- [ ] Supabase Auth configured with Google OAuth provider
- [ ] User profile automatically created in \`users\` table on first login
- [ ] Successful login redirects to agent configuration page
- [ ] Failed authentication shows clear error messages
- [ ] User session persists across browser refreshes
- [ ] Logout functionality clears session completely

## Technical Notes
- Use Supabase Auth with Google provider
- Implement auth state management in Next.js
- Create user record with email, name, avatar_url from Google profile
- Set up protected routes middleware

## Test Plan
- Test Google OAuth flow end-to-end
- Verify user creation in database
- Test session persistence and logout
- Test error handling for auth failures`,
    dependencies: []
  },
  {
    identifier: 'RAG-2',
    title: 'Row-Level Security Setup',
    epic: 'Authentication & User Management',
    priority: 1,
    estimate: 5,
    labels: ['backend', 'auth', 'security'],
    description: `## Problem
Ensure users can only access their own data and prevent unauthorized access to other users' agents, documents, and sessions.

## Acceptance Criteria
- [ ] RLS policies implemented for all user-scoped tables
- [ ] Users can only read/write their own agents, documents, sessions
- [ ] Admin role can access all data for purge operations
- [ ] RLS policies tested with multiple user accounts
- [ ] No data leakage between users verified
- [ ] Performance impact of RLS policies measured and acceptable

## Technical Notes
- Implement RLS policies in Supabase for: users, agents, documents, sessions, queries, answers
- Create admin role with bypass permissions
- Use \`auth.uid()\` in policy conditions
- Test policies with different user contexts

## Test Plan
- Create test users and verify data isolation
- Test admin access to all data
- Performance test RLS policy impact
- Security audit of all table access patterns`,
    dependencies: ['RAG-1']
  },
  {
    identifier: 'RAG-3',
    title: 'Agent Configuration UI',
    epic: 'Agent Configuration',
    priority: 1,
    estimate: 5,
    labels: ['frontend'],
    description: `## Problem
Users need an intuitive interface to configure their RAG agent's behavior, prompts, and retrieval parameters.

## Acceptance Criteria
- [ ] Form with fields for agent name, description, system prompt
- [ ] Query template editor with syntax highlighting and placeholders
- [ ] Dropdown selectors for embedding and generation models
- [ ] Sliders for retrieval parameters (k=1-20, threshold=0.1-1.0)
- [ ] Confidence threshold sliders (display, fail-safe)
- [ ] Save button persists changes with loading state
- [ ] Reset button restores to last saved state
- [ ] Form validation with helpful error messages
- [ ] Mobile-responsive design

## Technical Notes
- Use React Hook Form for form management
- Implement syntax highlighting for prompt templates
- Use controlled components for all form inputs
- Add debounced auto-save functionality
- Validate prompt templates for required placeholders

## Test Plan
- Test all form inputs and validation
- Verify save/reset functionality
- Test mobile responsiveness
- Test with various prompt template formats`,
    dependencies: ['RAG-1']
  },
  {
    identifier: 'RAG-4',
    title: 'Agent Persistence Layer',
    epic: 'Agent Configuration',
    priority: 1,
    estimate: 3,
    labels: ['backend'],
    description: `## Problem
Agent configurations need to be stored, retrieved, and versioned in the database with proper validation.

## Acceptance Criteria
- [ ] CRUD operations for agents via Supabase client
- [ ] Default agent automatically created on user signup
- [ ] Agent configuration versioning support
- [ ] Validation for all agent parameters (prompts, thresholds, models)
- [ ] Optimistic updates with error rollback
- [ ] Agent deletion with cascade to related data

## Technical Notes
- Implement agent service layer with TypeScript interfaces
- Add database triggers for updated_at timestamps
- Validate model names against supported list
- Implement soft delete for agents with active sessions

## Test Plan
- Test CRUD operations for agents
- Verify default agent creation
- Test validation rules
- Test cascade deletion behavior`,
    dependencies: ['RAG-2']
  },
  {
    identifier: 'RAG-5',
    title: 'PDF Upload Interface',
    epic: 'Document Ingestion & Indexing',
    priority: 1,
    estimate: 3,
    labels: ['frontend'],
    description: `## Problem
Users need an intuitive way to upload PDF documents and manage their document library with version control.

## Acceptance Criteria
- [ ] Drag-and-drop upload area for PDF files (≤50MB)
- [ ] Re-embed checkbox with tooltip explaining when to use
- [ ] Upload progress indicator with percentage and cancel option
- [ ] File validation (PDF only, size limit) with clear error messages
- [ ] Document list showing title, upload date, version, status
- [ ] Version history view for each document
- [ ] Document deletion with confirmation dialog

## Technical Notes
- Use react-dropzone for file upload UI
- Implement chunked upload for large files
- Store files in Supabase Storage with organized folder structure
- Add file type validation and virus scanning

## Test Plan
- Test drag-and-drop and click upload
- Test file validation and error handling
- Test upload progress and cancellation
- Test document list and version history`,
    dependencies: ['RAG-3']
  }
];

// Continue with more issues...
const ADDITIONAL_ISSUES = [
  {
    identifier: 'RAG-6',
    title: 'PDF Processing Pipeline',
    epic: 'Document Ingestion & Indexing',
    priority: 1,
    estimate: 8,
    labels: ['backend', 'retrieval'],
    description: `## Problem
Uploaded PDFs need to be parsed, chunked, embedded, and stored in vector database with proper metadata tracking.

## Acceptance Criteria
- [ ] PDF text extraction with layout preservation
- [ ] Intelligent chunking (500-800 tokens, 10-15% overlap)
- [ ] OpenAI embedding generation with error handling
- [ ] Pinecone upsert with proper namespace management
- [ ] Document versioning with checksum validation
- [ ] Metadata storage linking chunks to documents
- [ ] Progress tracking for long-running operations
- [ ] Retry logic for failed operations
- [ ] Cleanup of failed/partial uploads

## Technical Notes
- Use PDF parsing library (pdf-parse or similar)
- Implement semantic chunking with sentence boundaries
- Batch embedding requests for efficiency
- Use Pinecone namespace pattern: \`user_id:agent_id\`
- Store chunk metadata in Supabase with vector IDs

## Test Plan
- Test with various PDF formats and sizes
- Verify chunking quality and overlap
- Test embedding generation and storage
- Test error handling and retry logic
- Performance test with large documents`,
    dependencies: ['RAG-4']
  },
  {
    identifier: 'RAG-7',
    title: 'Vector Storage Integration',
    epic: 'Document Ingestion & Indexing',
    priority: 1,
    estimate: 5,
    labels: ['backend', 'infra'],
    description: `## Problem
Need robust vector storage and retrieval system with proper namespace isolation and similarity search capabilities.

## Acceptance Criteria
- [ ] Pinecone index configuration with appropriate dimensions
- [ ] Upsert operations with metadata and error handling
- [ ] Similarity search with configurable k and threshold
- [ ] Namespace isolation per user/agent combination
- [ ] Batch operations for efficiency
- [ ] Connection pooling and retry logic
- [ ] Vector deletion for document removal
- [ ] Performance monitoring and optimization

## Technical Notes
- Configure Pinecone index with 1536 dimensions for OpenAI embeddings
- Implement connection pooling for Pinecone client
- Use metadata filtering for efficient retrieval
- Add circuit breaker pattern for reliability

## Test Plan
- Test vector upsert and retrieval operations
- Verify namespace isolation between users
- Performance test with large vector sets
- Test error handling and retry logic`,
    dependencies: ['RAG-6']
  }
];

// Combine all issues
const ALL_ISSUES = [...ISSUES, ...ADDITIONAL_ISSUES];

async function createIssues() {
  console.log('🚀 Creating Linear issues for RAG Framework App v1...\n');

  try {
    // Get project info if not loaded
    if (!projectInfo.teamId) {
      console.log('📋 Fetching project information...');
      const projectQuery = `
        query GetProject($projectId: String!) {
          project(id: $projectId) {
            id
            name
            teams {
              nodes {
                id
                name
              }
            }
          }
        }
      `;

      const projectData = await linearQuery(projectQuery, { projectId: PROJECT_ID });
      projectInfo.teamId = projectData.project.teams.nodes[0].id;
      console.log(`✅ Using team: ${projectData.project.teams.nodes[0].name}\n`);
    }
    // Preload existing issues to avoid duplicates by title
    console.log('📋 Fetching existing issues...');
    const existingIssuesQuery = `
      query GetProjectIssues($projectId: String!) {
        project(id: $projectId) {
          issues(first: 250) {
            nodes { id title identifier url }
          }
        }
      }
    `;
    const existingIssuesData = await linearQuery(existingIssuesQuery, { projectId: PROJECT_ID });
    const existingNodes = (existingIssuesData && existingIssuesData.project && existingIssuesData.project.issues && existingIssuesData.project.issues.nodes) || [];
    const existingTitles = new Set(existingNodes.map(n => (n.title || '').trim().toLowerCase()));
    console.log(`✅ Found ${existingNodes.length} existing issues in project`);


    // Create issues
    console.log('📋 Creating issues...');
    const createdIssues = {};

    for (const issue of ALL_ISSUES) {
      const createIssueMutation = `
        mutation CreateIssue($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue {
              id
              identifier
              title
              url
            }
          }
        }
      `;

      // Skip if issue with same title already exists
      if (existingTitles.has((issue.title || '').trim().toLowerCase())) {
        console.log(`⏭️  Skipped (exists): ${issue.title}`);
      } else {
        const issueInput = {
          title: issue.title,
          description: issue.description,
          priority: issue.priority,
          estimate: issue.estimate,
          teamId: projectInfo.teamId,
          projectId: PROJECT_ID
        };

        let issueResult;
        try {
          issueResult = await linearQuery(createIssueMutation, { input: issueInput });
        } catch (e) {
          console.log(`⚠️  API error for ${issue.identifier}: ${e.message}`);
        }

        if (issueResult && issueResult.issueCreate && issueResult.issueCreate.success) {
          const createdIssue = issueResult.issueCreate.issue;
          createdIssues[issue.identifier] = createdIssue;
          existingTitles.add((issue.title || '').trim().toLowerCase());
          console.log(`✅ Created: ${createdIssue.identifier} - ${createdIssue.title}`);
        } else {
          console.log(`❌ Failed to create: ${issue.identifier} - ${issue.title}`);
          console.log('ℹ️  Raw issueCreate result:', JSON.stringify(issueResult, null, 2));
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n🎉 Successfully created ${Object.keys(createdIssues).length} issues!`);
    console.log('\n📊 Summary:');
    Object.values(createdIssues).forEach(issue => {
      console.log(`- ${issue.identifier}: ${issue.title}`);
    });

    console.log('\n🔄 Next steps:');
    console.log('1. Set up issue dependencies in Linear UI');
    console.log('2. Assign issues to appropriate milestones/epics');
    console.log('3. Add labels to issues');
    console.log('4. Create custom fields (Component, Risk, etc.)');
    console.log('5. Set up saved views and filters');

  } catch (error) {
    console.error('❌ Error creating issues:', error.message);
    process.exit(1);
  }
}

// Run the script
createIssues();
