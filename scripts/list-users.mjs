#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, 'supabase', '.env');

function loadEnv(p) {
  const out = {};
  if (!fs.existsSync(p)) return out;
  const txt = fs.readFileSync(p, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    out[k] = v;
  }
  return out;
}

const env = { ...process.env, ...loadEnv(envPath) };
const SUPABASE_URL = env.SUPABASE_URL || env.SUPABASE_URL_LOCAL || 'http://127.0.0.1:54321';
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY_LOCAL;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in supabase/.env');
  process.exit(1);
}

const email = process.argv[2];
const url = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users` + (email ? `?email=${encodeURIComponent(email)}` : '');

const res = await fetch(url, {
  method: 'GET',
  headers: {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`
  }
});
const text = await res.text();
if (!res.ok) {
  console.error('Failed:', res.status, text);
  process.exit(1);
}
console.log(text);

