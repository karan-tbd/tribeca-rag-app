# 🚀 Linear Project Setup Instructions

## Quick Start

### Step 1: Get Your Linear API Token
1. Go to [Linear Settings > API](https://linear.app/settings/api)
2. Click "Create new token"
3. Give it a name like "RAG Project Setup"
4. Copy the token (keep it secure!)

### Step 2: Run the Project Creation Script
```bash
node scripts/linear/create-linear-project.js YOUR_LINEAR_API_TOKEN
```

This will create:
- ✅ Project: "RAG Framework App v1" with key "RAG"
- ✅ 8 Labels (frontend, backend, infra, evals, retrieval, auth, observability, docs)
- ✅ 8 Epics as milestones with proper timelines
- ✅ Project configuration and team assignment

### Step 3: Run the Issues Creation Script
```bash
node scripts/linear/create-linear-issues.js YOUR_LINEAR_API_TOKEN PROJECT_ID
```

The PROJECT_ID will be provided by the first script, or you can find it in the `linear-project-info.json` file.

This will create:
- ✅ 19 seed issues with detailed descriptions
- ✅ Proper acceptance criteria for each issue
- ✅ Technical notes and test plans
- ✅ Sprint-ready issue breakdown

## Manual Configuration Steps

After running the scripts, you'll need to complete these steps manually in Linear:

### 1. Custom Fields Setup
Go to Team Settings > Custom Fields and add:

**Component** (Select field)
- ingestion
- retrieval  
- generation
- evals
- sessions
- dashboard
- persistence
- security

**Estimate** (Select field)
- XS (1 point)
- S (2 points)
- M (3 points)
- L (5 points)
- XL (8 points)
- XXL (13 points)

**Risk** (Select field)
- Low
- Medium
- High

**Acceptance** (Text field)
- For detailed acceptance criteria

### 2. Issue Templates
Create these templates in Team Settings > Templates:

**Feature Template:**
```
## Problem
[What problem does this solve?]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Notes
[Implementation details, API endpoints, database changes]

## Dependencies
[Other issues that must be completed first]

## Test Plan
[How to verify this works correctly]
```

**Bug Template:**
```
## Environment
[Development/Staging/Production]

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Expected vs Actual
**Expected:** [What should happen]
**Actual:** [What actually happens]

## Severity
[Low/Medium/High/Critical]

## Fix Plan
[Proposed solution approach]
```

### 3. Issue Dependencies
Set up these dependencies manually:
- RAG-2 depends on RAG-1
- RAG-4 depends on RAG-2
- RAG-5 depends on RAG-3
- RAG-6 depends on RAG-4
- RAG-7 depends on RAG-6
- RAG-8 depends on RAG-7
- RAG-9 depends on RAG-8
- RAG-10 depends on RAG-8, RAG-7
- RAG-11 depends on RAG-10
- RAG-12 depends on RAG-11
- RAG-13 depends on RAG-12
- RAG-14 depends on RAG-13
- RAG-15 depends on RAG-14
- RAG-16 depends on RAG-2
- RAG-18 depends on RAG-17
- RAG-19 depends on RAG-17

### 4. Assign Issues to Epics
- **Authentication & User Management:** RAG-1, RAG-2
- **Agent Configuration:** RAG-3, RAG-4
- **Document Ingestion & Indexing:** RAG-5, RAG-6, RAG-7
- **Session-based Chat & Prompt Assembly:** RAG-8, RAG-9, RAG-10
- **Evaluation & Confidence System:** RAG-11, RAG-12, RAG-13
- **Dashboard & Analytics:** RAG-14, RAG-15
- **Security, RLS & Purge:** RAG-16
- **Deployment & Observability:** RAG-17, RAG-18, RAG-19

### 5. Apply Labels to Issues
- RAG-1: backend, auth
- RAG-2: backend, auth, security
- RAG-3: frontend
- RAG-4: backend
- RAG-5: frontend
- RAG-6: backend, retrieval
- RAG-7: backend, infra
- RAG-8: backend
- RAG-9: frontend
- RAG-10: backend, retrieval
- RAG-11: backend, evals
- RAG-12: backend, evals
- RAG-13: backend, evals
- RAG-14: backend, observability
- RAG-15: frontend, observability
- RAG-16: backend, security
- RAG-17: infra
- RAG-18: backend, observability, infra
- RAG-19: infra

### 6. Set Custom Field Values
For each issue, set:
- **Component:** Based on the issue focus area
- **Estimate:** As specified in the issue descriptions
- **Risk:** Low/Medium/High based on complexity
- **Acceptance:** Copy from issue description

### 7. Create Saved Views
Set up these filters for efficient project management:

**P0 v1 Open**
- Filter: Status not in [Done] AND Priority = 1
- Sort: Created date asc

**Blocked Issues**
- Filter: Status = Blocked
- Sort: Updated date desc

**High Risk Items**
- Filter: Risk = High AND Status not in [Done]
- Sort: Priority desc

**Current Sprint**
- Filter: Sprint = [Current Sprint]
- Sort: Status, Priority desc

**Ready for Development**
- Filter: Status = Ready
- Sort: Priority desc, Estimate asc

### 8. Sprint Planning
Create 3 sprints (2 weeks each):

**Sprint 1: Foundation (Weeks 1-2)**
- RAG-1, RAG-2, RAG-3, RAG-4, RAG-17
- Goal: Authentication, agent config, basic infrastructure

**Sprint 2: RAG Core (Weeks 3-4)**
- RAG-5, RAG-6, RAG-7, RAG-8, RAG-9, RAG-10
- Goal: Document ingestion, vector storage, chat interface

**Sprint 3: Intelligence & Polish (Weeks 5-6)**
- RAG-11, RAG-12, RAG-13, RAG-14, RAG-15, RAG-16, RAG-18, RAG-19
- Goal: Evaluation system, dashboard, security, production readiness

## Integration Setup

### GitHub Integration
1. Go to Team Settings > Integrations
2. Connect your GitHub repository
3. Enable automatic issue updates from commits and PRs

### Slack Integration
1. Install Linear Slack app
2. Configure notifications for issue updates
3. Set up daily standup summaries

## Success Metrics

Track these KPIs in your Linear dashboard:
- **Velocity:** Story points completed per sprint
- **Cycle Time:** Average time from "Ready" to "Done"
- **Blocked Issues:** Should be 0 for >2 days
- **Sprint Goal Achievement:** 100% completion rate
- **Risk Mitigation:** High-risk issues resolved early

## Troubleshooting

### Common Issues:
1. **API Rate Limiting:** Add delays between requests (already handled in scripts)
2. **Permission Errors:** Ensure your API token has admin permissions
3. **Team Not Found:** Make sure you have at least one team in Linear
4. **Duplicate Issues:** Check if issues already exist before running scripts

### Getting Help:
- Linear API Documentation: https://developers.linear.app/docs
- Linear Community: https://linear.app/community
- Project files: Check `linear-project-info.json` for IDs and URLs

---

## 🎯 What You'll Have After Setup

✅ **Complete Linear Project** with 19 issues across 8 epics  
✅ **Sprint Planning** with clear deliverables and timelines  
✅ **Issue Dependencies** mapped for logical development flow  
✅ **Custom Fields** for component tracking and risk assessment  
✅ **Labels & Templates** for consistent issue management  
✅ **Saved Views** for efficient project monitoring  

**Project URL:** Will be provided after running the setup scripts  
**Timeline:** 6 weeks from start to production deployment  
**Team Size:** Solo builder (simplified workflows)  

Ready to build your RAG Framework App! 🚀
