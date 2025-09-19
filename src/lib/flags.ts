// Centralized feature flags for safe, incremental rollout
// Toggle these in build-time env or by editing for local development
// In CI/Prod, prefer sourcing from environment and building conditionally if needed.

import { TrendingUp } from "lucide-react";

export const FEATURE_FLAGS = {
  // Track 1: Authentication
  ENABLE_AUTH_PROVIDERS: true,
  ENABLE_AUTH_GOOGLE: true,
  ENABLE_AUTH_MICROSOFT: true,
  ENABLE_AUTH_EMAIL: true, // Development email/password login

  // Track 2: Agent Configuration
  ENABLE_AGENT_CONFIG: true,

  // Track 3: Document Pipeline
  ENABLE_DOCUMENT_UPLOAD: true,
  ENABLE_PDF_PROCESSING: true,
  ENABLE_VECTOR_STORAGE: false,

  // Track 4: Chat
  ENABLE_CHAT_SESSIONS: false,
  ENABLE_CHAT_UI: false,
  ENABLE_CHAT_COMPLETION: false,

  // Track 5: Global Docs
  ENABLE_GLOBAL_DOCS: false,
} as const;

export const USER_FLAGS = {
  BETA_USER: false,
  EARLY_ACCESS: false,
} as const;

