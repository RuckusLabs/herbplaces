import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY; 
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
export const configurationMessage = 'The directory is temporarily unavailable. Please try again later.';
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;

export default supabase;
