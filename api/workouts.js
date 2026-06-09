import { supabase } from './supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { athlete_id, start, end } = req.query;
      if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
      let q = supabase.from('planned_workouts').select('*').eq('athlete_id', athlete_id).order('date', { ascending: true });
      if (start) q = q.gte('date', start);
      if (end) q = q.lte('date', end);
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ workouts: data });
    }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};

    if (req.method === 'POST') {
      const { athlete_id, date, sport, title, description, tss_target, workout_type, duration_minutes } = body;
      if (!athlete_id || !date) return res.status(400).json({ error: 'Missing athlete_id or date' });
      const { data, error } = await supabase.from('planned_workouts').insert({
        athlete_id, date, sport, title, description, tss_target, workout_type, duration_minutes, completed: false
      }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ workout: data });
    }

    if (req.method === 'PUT') {
      const { id, ...updates } = body;
      if (!id) return res.status(400).json({ error: 'Missing workout id' });
      const { data, error } = await supabase.from('planned_workouts').update(updates).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ workout: data });
    }

    if (req.method === 'DELETE') {
      const id = body.id || req.query.id;
      if (!id) return res.status(400).json({ error: 'Missing workout id' });
      const { error } = await supabase.from('planned_workouts').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
