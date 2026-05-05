import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getEdgeFunctionUrl = (functionName: string) =>
  `${supabaseUrl}/functions/v1/${functionName}`;

export const getAuthHeaders = () => ({
  Authorization: `Bearer ${supabaseAnonKey}`,
  'Content-Type': 'application/json',
});
