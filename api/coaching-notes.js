import { supabase } from './supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { athlete_id, date } = req.query;
      if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
      let q = supabase.from('coaching_notes').select('*').eq('athlete_id', athlete_id).order('date', { ascending: false });
      if (date) q = q.eq('date', date);
      const { data, error } = await q;
      if (error) {
        if (error.code === '42P01') return res.status(200).json({ notes: [] });
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ notes: data });
    }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};

    if (req.method === 'POST') {
      const { athlete_id, date, note } = body;
      if (!athlete_id || !date) return res.status(400).json({ error: 'Missing athlete_id or date' });
      // Check for existing row first to avoid needing a unique constraint
      const { data: existing } = await supabase
        .from('coaching_notes')
        .select('id')
        .eq('athlete_id', athlete_id)
        .eq('date', date)
        .maybeSingle();
      let result;
      if (existing) {
        result = await supabase
          .from('coaching_notes')
          .update({ note })
          .eq('id', existing.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('coaching_notes')
          .insert({ athlete_id, date, note })
          .select()
          .single();
      }
      if (result.error) return res.status(500).json({ error: result.error.message });
      return res.status(200).json({ note: result.data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
