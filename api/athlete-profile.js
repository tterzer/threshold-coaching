import { supabase } from './supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { athlete_id } = req.query;
      if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
      const { data, error } = await supabase
        .from('athlete_profiles')
        .select('*')
        .eq('athlete_id', athlete_id)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message, code: error.code });
      return res.status(200).json({ profile: data || null });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      body = body || {};
      console.log('[athlete-profile POST] body:', JSON.stringify(body));
      const { athlete_id, ...fields } = body;
      if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });

      const { data: existing } = await supabase
        .from('athlete_profiles')
        .select('id')
        .eq('athlete_id', athlete_id)
        .maybeSingle();

      let result;
      if (existing) {
        result = await supabase
          .from('athlete_profiles')
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq('athlete_id', athlete_id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('athlete_profiles')
          .insert({ athlete_id, ...fields })
          .select()
          .single();
      }

      if (result.error) {
        console.error('[athlete-profile POST error]', result.error);
        return res.status(500).json({ error: result.error.message, code: result.error.code, details: result.error.details, hint: result.error.hint });
      }
      return res.status(200).json({ profile: result.data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[athlete-profile] unexpected error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
