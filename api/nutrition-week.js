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
        .from('week_plans')
        .select('*')
        .eq('athlete_id', athlete_id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) return res.status(500).json({ error: error.message });
      if (!data || data.length === 0) return res.status(200).json({ sessions: null });
      return res.status(200).json(data[0]);
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      body = body || {};
      if (!body.athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });

      const { data, error } = await supabase
        .from('week_plans')
        .insert(body)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
