# Linear project scripts and docs

Repository organization for all Linear-related automation and documentation.

- Scripts live under scripts/linear
  - create-linear-project.js
  - create-linear-milestones.js
  - create-linear-issues.js
  - populate-all-issues.js
  - assign-epics-and-deps.js
  - dedupe-linear-issues.js
  - label-sprint-and-p0.js
  - get-project-id.js

- Documentation lives under docs/linear
  - LINEAR_SETUP_INSTRUCTIONS.md (copy-paste commands updated for new paths)
  - linear-project-setup.md
  - linear-issues-detailed.md
  - linear-setup-summary.md

Usage examples (from repo root):

- Create project
  node scripts/linear/create-linear-project.js <TOKEN>

- Create issues
  node scripts/linear/create-linear-issues.js <TOKEN> <PROJECT_ID>

- Populate all issues/labels/epics/deps
  node scripts/linear/populate-all-issues.js <TOKEN> <PROJECT_ID>

- Assign epics and wire deps (subset)
  node scripts/linear/assign-epics-and-deps.js <TOKEN> <PROJECT_ID>

- Dedupe issues by title (cancels duplicates)
  node scripts/linear/dedupe-linear-issues.js <TOKEN> <PROJECT_ID>

- Add P0 and current-sprint labels
  node scripts/linear/label-sprint-and-p0.js <TOKEN> <PROJECT_ID>

- Lookup project ID by name
  node scripts/linear/get-project-id.js "RAG Framework App v1" <TOKEN>

