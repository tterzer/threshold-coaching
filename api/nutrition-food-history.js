// GET  ?athlete_id=&q=&is_favorite=true&limit=8  — fetch history/favorites
// POST {food, athlete_id}                          — upsert (increment use_count)
// PATCH ?id=xxx  {is_favorite: bool}               — toggle favorite by id
import { supabase } from './supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── GET ───────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { q = '', athlete_id, limit: limitParam, is_favorite } = req.query;
      const limit = Math.min(parseInt(limitParam) || 8, 50);
      const orderCol = q ? 'use_count' : 'last_used';
      let query = supabase
        .from('food_history')
        .select('id,name,per100g,serving_size,serving_unit,use_count,last_used,is_favorite,is_combo,combo_name')
        .ilike('name', `%${q}%`)
        .eq('is_combo', false)
        .order(orderCol, { ascending: false })
        .limit(limit);
      if (athlete_id) query = query.eq('athlete_id', athlete_id);
      if (is_favorite === 'true') query = query.eq('is_favorite', true);
      const { data, error } = await query;
      if (error) return res.status(200).json([]);
      return res.status(200).json(data || []);
    }

    // ── PATCH — toggle is_favorite by id ─────────────────────────
    if (req.method === 'PATCH') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      const { is_favorite } = body || {};
      if (is_favorite === undefined) return res.status(400).json({ error: 'Missing is_favorite' });
      const { error } = await supabase
        .from('food_history')
        .update({ is_favorite, last_used: new Date().toISOString() })
        .eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    // ── POST — upsert (increment use_count / set favorite) ───────
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      const { food, athlete_id, set_favorite } = body || {};
      if (!food?.name || !food?.per100g) return res.status(400).json({ ok: false });

      let query = supabase
        .from('food_history')
        .select('id, use_count')
        .ilike('name', food.name)
        .limit(1);
      if (athlete_id) query = query.eq('athlete_id', athlete_id);
      const { data: existing } = await query;

      if (existing && existing.length > 0) {
        const upd = set_favorite !== undefined
          ? { is_favorite: food.is_favorite, last_used: new Date().toISOString() }
          : { use_count: existing[0].use_count + 1, last_used: new Date().toISOString() };
        await supabase.from('food_history').update(upd).eq('id', existing[0].id);
      } else {
        await supabase.from('food_history').insert({
          athlete_id: athlete_id || null,
          name: food.name,
          search_term: food.name,
          per100g: food.per100g,
          serving_size: food.serving_size || 100,
          serving_unit: food.serving_unit || 'g',
          use_count: 1,
          is_favorite: food.is_favorite || false,
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
