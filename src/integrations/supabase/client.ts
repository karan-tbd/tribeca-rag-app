import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Environment-aware Supabase config for Vite (local vs cloud)
const isLocal =
  typeof window !== 'undefined'
    ? window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    : import.meta.env.MODE !== 'production';

const SUPABASE_URL = isLocal
  ? (import.meta.env.VITE_SUPABASE_URL_LOCAL ?? import.meta.env.VITE_SUPABASE_URL)
  : import.meta.env.VITE_SUPABASE_URL;

const SUPABASE_PUBLISHABLE_KEY = isLocal
  ? (import.meta.env.VITE_SUPABASE_ANON_KEY_LOCAL ?? import.meta.env.VITE_SUPABASE_ANON_KEY)
  : import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Missing Supabase env vars. Please set VITE_SUPABASE_URL[_LOCAL] and VITE_SUPABASE_ANON_KEY[_LOCAL].'
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});