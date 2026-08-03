import { supabase } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('athlete_cal_notes')
        .select('athlete_id')
        .is('coach_read_at', null);
      if (error) return res.status(500).json({ error: error.message });
      const counts = {};
      (data || []).forEach(row => {
        counts[row.athlete_id] = (counts[row.athlete_id] || 0) + 1;
      });
      return res.status(200).json({ counts });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      const { athlete_id } = body || {};
      if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
      const { error } = await supabase
        .from('athlete_cal_notes')
        .update({ coach_read_at: new Date().toISOString() })
        .eq('athlete_id', athlete_id)
        .is('coach_read_at', null);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
