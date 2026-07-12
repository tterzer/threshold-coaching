import { supabase } from './supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { athlete_id } = req.query;
      if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
      const { data, error } = await supabase
        .from('athlete_cal_notes')
        .select('*')
        .eq('athlete_id', athlete_id)
        .order('date', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ notes: data });
    }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};

    if (req.method === 'POST') {
      const { athlete_id, date, note_text } = body;
      if (!athlete_id || !date) return res.status(400).json({ error: 'Missing athlete_id or date' });
      const { data, error } = await supabase
        .from('athlete_cal_notes')
        .insert({ athlete_id, date, note_text: note_text || '' })
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ note: data });
    }

    if (req.method === 'PUT') {
      const { id, note_text } = body;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { data, error } = await supabase
        .from('athlete_cal_notes')
        .update({ note_text: note_text || '' })
        .eq('id', id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ note: data });
    }

    if (req.method === 'DELETE') {
      const id = body.id || req.query.id;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { error } = await supabase.from('athlete_cal_notes').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
