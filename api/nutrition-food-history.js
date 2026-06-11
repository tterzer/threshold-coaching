import { supabase } from './supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { q = '', athlete_id } = req.query;
      let query = supabase
        .from('food_history')
        .select('*')
        .ilike('name', `%${q}%`)
        .order('use_count', { ascending: false })
        .limit(5);
      if (athlete_id) query = query.eq('athlete_id', athlete_id);

      const { data, error } = await query;
      if (error) return res.status(200).json([]);
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      const { food, athlete_id } = body || {};
      if (!food?.name || !food?.per100g) return res.status(400).json({ ok: false });

      let query = supabase
        .from('food_history')
        .select('id, use_count')
        .ilike('name', food.name)
        .limit(1);
      if (athlete_id) query = query.eq('athlete_id', athlete_id);

      const { data: existing } = await query;

      if (existing && existing.length > 0) {
        await supabase
          .from('food_history')
          .update({ use_count: existing[0].use_count + 1, last_used: new Date().toISOString() })
          .eq('id', existing[0].id);
      } else {
        await supabase.from('food_history').insert({
          athlete_id: athlete_id || null,
          name: food.name,
          search_term: food.name,
          per100g: food.per100g,
          serving_size: food.serving_size || 100,
          serving_unit: food.serving_unit || 'g',
          use_count: 1,
          last_used: new Date().toISOString(),
        });
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
