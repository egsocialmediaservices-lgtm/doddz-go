const SUPABASE_URL = 'https://zapjfaqplhvdyebehnxa.supabase.co';

const SUPABASE_KEY = 'sb_publishable_f_e5CvXO7Mvj1sbufitkpg_skQcYbji';

const supabaseClient = window.supabase?.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

window.supabaseClient = supabaseClient;

if (!supabaseClient) {
  console.error('[Supabase] Client library failed to load. ProductStore will use its local cache.');
}