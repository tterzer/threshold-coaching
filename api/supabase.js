import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jrgyfokygizsxtupbisg.supabase.co';
const supabaseAnonKey = 'sb_publishable_LcoHaks3xpZW4Om8IOT5Ng_6nwMYxbe';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
