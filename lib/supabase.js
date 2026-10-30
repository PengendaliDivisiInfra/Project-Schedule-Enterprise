import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Mencegah multiple instances saat Next.js melakukan Server-Side Rendering (SSR)
const globalForSupabase = globalThis;

export const supabase = 
  globalForSupabase.supabase || 
  createClient(supabaseUrl, supabaseAnonKey);

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabase = supabase;
}
