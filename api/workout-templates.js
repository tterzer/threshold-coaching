import { supabase } from './supabase.js';

const COACH_ID = 'fdba3831-f111-41d4-bc02-4c80340ce10a';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('coach_id', COACH_ID)
        .order('sport')
        .order('title');
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ templates: data || [] });
    }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};

    if (req.method === 'POST') {
      const { title, sport, intensity, fuelpro_type, description, tags } = body;
      if (!title || !sport) return res.status(400).json({ error: 'Missing title or sport' });
      const { data, error } = await supabase
        .from('workout_templates')
        .insert({ coach_id: COACH_ID, title, sport, intensity: intensity||null, fuelpro_type: fuelpro_type!=null?fuelpro_type:null, description: description||null, tags: tags||null })
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ template: data });
    }

    if (req.method === 'PUT') {
      const { id, title, sport, intensity, fuelpro_type, description, tags } = body;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const updates = { updated_at: new Date().toISOString() };
      if (title !== undefined) updates.title = title;
      if (sport !== undefined) updates.sport = sport;
      if (intensity !== undefined) updates.intensity = intensity || null;
      if (fuelpro_type !== undefined) updates.fuelpro_type = fuelpro_type != null ? fuelpro_type : null;
      if (description !== undefined) updates.description = description || null;
      if (tags !== undefined) updates.tags = tags || null;
      const { data, error } = await supabase
        .from('workout_templates')
        .update(updates)
        .eq('id', id)
        .eq('coach_id', COACH_ID)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ template: data });
    }

    if (req.method === 'DELETE') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { error } = await supabase
        .from('workout_templates')
        .delete()
        .eq('id', id)
        .eq('coach_id', COACH_ID);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
