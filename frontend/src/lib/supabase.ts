/**
 * The frontend talks to Supabase Auth directly (matching Milestone 4a's
 * design) -- it never goes through our own API for sign up / log in. Our
 * API only ever verifies the token this produces.
 */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY -- copy .env.example to .env and fill them in.')
}

export const supabase = createClient(url, anonKey)
