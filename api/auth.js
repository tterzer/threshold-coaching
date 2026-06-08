import { supabase } from './supabase.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.query;
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  try {
    if (action === 'register') {
      const { email, password, name } = body;
      if (!email || !password || !name) return res.status(400).json({ error: 'Missing email, password, or name' });
      const normalizedEmail = String(email).trim().toLowerCase();
      const { data: existing } = await supabase.from('athletes').select('id').eq('email', normalizedEmail).maybeSingle();
      if (existing) return res.status(409).json({ error: 'An account with this email already exists' });
      const password_hash = await bcrypt.hash(password, 10);
      const { data, error } = await supabase.from('athletes').insert({ email: normalizedEmail, password_hash, name }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      delete data.password_hash;
      return res.status(200).json({ athlete: data });
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

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
