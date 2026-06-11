import { supabase } from './supabase.js';

const DEFAULTS = {
  weight_lbs: 168,
  goal_weight_lbs: 159,
  mode: 1,
  weekly_loss_target: 0.5,
  protein_factor: 1.09,
  fat_floor: 85,
  fat_ceiling: 110,
};

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
        .from('profiles')
        .select('*')
        .eq('athlete_id', athlete_id)
        .limit(1);

      if (error) return res.status(500).json({ error: error.message });
      if (!data || data.length === 0) return res.status(200).json({ ...DEFAULTS, athlete_id });
      return res.status(200).json(data[0]);
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      body = body || {};
      const { athlete_id } = body;
      if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });

      // Upsert: check existing then update or insert
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('athlete_id', athlete_id)
        .limit(1);

      let result;
      if (existing && existing.length > 0) {
        result = await supabase
          .from('profiles')
          .update(body)
          .eq('athlete_id', athlete_id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('profiles')
          .insert(body)
          .select()
          .single();
      }

      if (result.error) return res.status(500).json({ error: result.error.message });
      return res.status(200).json(result.data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
