import { supabase } from './supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { athlete_id, year } = req.query;
      if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
      let q = supabase.from('races').select('*').eq('athlete_id', athlete_id).order('race_date', { ascending: true });
      if (year) {
        q = q.gte('race_date', year + '-01-01').lte('race_date', year + '-12-31');
      }
      const { data, error } = await q;
      if (error) {
        if (error.code === '42P01') return res.status(200).json({ races: [], _tableNotFound: true });
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ races: data });
    }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};

    if (req.method === 'POST') {
      const { athlete_id, name, race_date, priority, sport_type, distance, goal_time, notes } = body;
      if (!athlete_id || !name || !race_date) return res.status(400).json({ error: 'Missing required fields: athlete_id, name, race_date' });
      const { data, error } = await supabase.from('races').insert({
        athlete_id, name, race_date, priority, sport_type, distance, goal_time, notes
      }).select().single();
      if (error) {
        if (error.code === '42P01') return res.status(500).json({ error: 'races table not found — run the CREATE TABLE SQL in Supabase' });
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ race: data });
    }

    if (req.method === 'PUT') {
      const { id, athlete_id, ...updates } = body;
      if (!id) return res.status(400).json({ error: 'Missing race id' });
      const { data, error } = await supabase.from('races').update(updates).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ race: data });
    }

    if (req.method === 'DELETE') {
      const id = body.id || req.query.id;
      if (!id) return res.status(400).json({ error: 'Missing race id' });
      const { error } = await supabase.from('races').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
