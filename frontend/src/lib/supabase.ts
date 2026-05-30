import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wwetgctmuwhmspzhvphq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3ZXRnY3RtdXdobXNwemh2cGhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTE0MTUsImV4cCI6MjA5NTYyNzQxNX0.MJ_MqROAh_MOzrKajHiAK9Eo4F9fttp_HCrQitF2Pfk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-client-info': 'visualearn-web',
    },
  },
});
