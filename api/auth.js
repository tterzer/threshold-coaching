import { supabase } from './supabase.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // action can come from query string (?action=login) or JSON body ({ action: 'login' })
  const action = req.query.action || body.action;

  // GET requests: only get_profile is allowed
  if (req.method === 'GET') {
    if (action !== 'get_profile') return res.status(405).json({ error: 'Method not allowed' });
  } else if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (action === 'register') {
      const { email, password, name, intervals_athlete_id, intervals_api_key } = body;
      if (!email || !password || !name) return res.status(400).json({ error: 'Missing email, password, or name' });
      const normalizedEmail = String(email).trim().toLowerCase();
      const { data: existing } = await supabase.from('athletes').select('id').eq('email', normalizedEmail).maybeSingle();
      if (existing) return res.status(409).json({ error: 'Email already registered' });
      const password_hash = await bcrypt.hash(password, 10);
      const insertPayload = { email: normalizedEmail, password_hash, name, role: 'athlete' };
      if (intervals_athlete_id) insertPayload.intervals_athlete_id = intervals_athlete_id;
      if (intervals_api_key) insertPayload.intervals_api_key = intervals_api_key;
      const TRAVIS_ID = 'fdba3831-f111-41d4-bc02-4c80340ce10a';
      insertPayload.coach_id = TRAVIS_ID;
      const { data, error } = await supabase.from('athletes').insert(insertPayload).select().single();
      if (error) return res.status(500).json({ error: error.message });
      // Create athlete_profiles row so profile exists immediately
      await supabase.from('athlete_profiles').insert({ athlete_id: data.id });
      delete data.password_hash;
      return res.status(200).json({ ok: true });
    }

    if (action === 'login') {
      const { email, password } = body;
      if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
      const normalizedEmail = String(email).trim().toLowerCase();
      const { data, error } = await supabase.from('athletes').select('*').eq('email', normalizedEmail).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(401).json({ error: 'Invalid email or password' });
      const match = await bcrypt.compare(password, data.password_hash || '');
      if (!match) return res.status(401).json({ error: 'Invalid email or password' });
      delete data.password_hash;
      return res.status(200).json({ athlete: data });
    }

    if (action === 'update_profile') {
      const { athlete_id, intervals_athlete_id, intervals_api_key, name } = body;
      if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
      const updates = {};
      if (intervals_athlete_id !== undefined) updates.intervals_athlete_id = intervals_athlete_id;
      if (intervals_api_key !== undefined) updates.intervals_api_key = intervals_api_key;
      if (name !== undefined) updates.name = name;
      const { data, error } = await supabase.from('athletes').update(updates).eq('id', athlete_id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      delete data.password_hash;
      return res.status(200).json({ athlete: data });
    }

    if (action === 'get_profile') {
      const athlete_id = body.athlete_id || req.query.athlete_id;
      if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
      const { data, error } = await supabase.from('athletes').select('*').eq('id', athlete_id).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Athlete not found' });
      delete data.password_hash;
      return res.status(200).json({ athlete: data });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
