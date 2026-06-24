// ?type=search  GET ?q=  — USDA food search
// ?type=search  POST {barcode}  — Open Food Facts barcode lookup
// ?type=history GET ?q=&athlete_id=&is_favorite=true&is_combo=true|false&limit=8  — food history search
// ?type=history POST {food,athlete_id,is_combo,combo_name,combo_items}  — upsert food history / combo
// ?type=history PATCH ?id=xxx  {is_favorite: bool}  — toggle favorite by id
import { supabase } from './supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const type = req.query.type || 'search';

  try {
    // ── FOOD HISTORY ──────────────────────────────────────────────
    if (type === 'history') {
      if (req.method === 'GET') {
        const { q = '', athlete_id, limit: limitParam, is_favorite, is_combo } = req.query;
        const limit = Math.min(parseInt(limitParam) || 8, 50);
        const orderCol = q ? 'use_count' : 'last_used';
        let query = supabase
          .from('food_history')
          .select('id,name,per100g,serving_size,serving_unit,use_count,last_used,is_favorite,is_combo,combo_name,combo_items')
          .ilike('name', `%${q}%`)
          .order(orderCol, { ascending: false })
          .limit(limit);
        if (athlete_id) query = query.eq('athlete_id', athlete_id);
        if (is_favorite === 'true') query = query.eq('is_favorite', true);
        // Recent/favorites should exclude combos (they get their own tab);
        // is_combo can be null on rows inserted before this column existed,
        // so "false" has to match null too, not just exclude true.
        if (is_combo === 'true') query = query.eq('is_combo', true);
        else if (is_combo === 'false') query = query.or('is_combo.is.null,is_combo.eq.false');
        const { data, error } = await query;
        console.log('food_history GET athlete_id:', athlete_id, '| rows:', data?.length, '| error:', error?.message);
        if (error) { console.error('food_history GET error:', error); return res.status(200).json([]); }
        return res.status(200).json(data || []);
      }

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

      if (req.method === 'POST') {
        let body = req.body;
        if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
        const { food, athlete_id, set_favorite, name, per100g, serving_size, serving_unit, is_combo, combo_name, is_favorite, combo_items } = body || {};
        // Accept flat format (name/per100g at top level) or legacy nested {food:{}}
        const fname = name || food?.name;
        const fper100g = per100g || food?.per100g;
        if (!fname || !fper100g) return res.status(400).json({ ok: false, error: 'Missing name or per100g' });

        let query = supabase
          .from('food_history')
          .select('id, use_count')
          .ilike('name', fname)
          .limit(1);
        if (athlete_id) query = query.eq('athlete_id', athlete_id);
        const { data: existing } = await query;

        if (existing && existing.length > 0) {
          let upd;
          if (combo_items) {
            // Re-saving a combo under the same name -- replace its contents
            // instead of just bumping use_count, otherwise edits are silently lost.
            upd = { per100g: fper100g, is_combo: true, combo_name: combo_name || fname, combo_items, last_used: new Date().toISOString() };
          } else if (set_favorite !== undefined) {
            upd = { is_favorite: is_favorite ?? food?.is_favorite ?? false, last_used: new Date().toISOString() };
          } else {
            upd = { use_count: existing[0].use_count + 1, last_used: new Date().toISOString() };
          }
          await supabase.from('food_history').update(upd).eq('id', existing[0].id);
        } else {
          await supabase.from('food_history').insert({
            athlete_id: athlete_id || null,
            name: fname,
            search_term: fname,
            per100g: fper100g,
            serving_size: serving_size || food?.serving_size || 100,
            serving_unit: serving_unit || food?.serving_unit || 'g',
            use_count: 1,
            is_favorite: is_favorite || food?.is_favorite || false,
            is_combo: is_combo || food?.is_combo || false,
            combo_items: combo_items || food?.combo_items || null,
            combo_name: combo_name || food?.combo_name || null,
            last_used: new Date().toISOString(),
          });
        }
        return res.status(200).json({ ok: true });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ── FOOD SEARCH (default) ─────────────────────────────────────
    if (req.method === 'GET') {
      const { q } = req.query;
      if (!q) return res.status(400).json({ error: 'No query' });

      const usdaKey = process.env.USDA_API_KEY;
      if (!usdaKey) return res.status(500).json({ error: 'USDA_API_KEY not configured' });

      const r = await fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&pageSize=10&api_key=${usdaKey}`
      );
      const data = await r.json();

      const foods = (data.foods || []).map(food => {
        const nutrients = {};
        (food.foodNutrients || []).forEach(n => {
          if (n.nutrientName?.includes('Energy') && n.unitName === 'KCAL') nutrients.calories = Math.round(n.value || 0);
          if (n.nutrientName?.includes('Carbohydrate')) nutrients.carbs = Math.round(n.value || 0);
          if (n.nutrientName?.includes('Protein')) nutrients.protein = Math.round(n.value || 0);
          if (n.nutrientName?.includes('Total lipid')) nutrients.fat = Math.round(n.value || 0);
        });
        return {
          id: food.fdcId,
          name: food.description,
          brand: food.brandOwner || null,
          serving_size: food.servingSize || 100,
          serving_unit: food.servingSizeUnit || 'g',
          per100g: {
            calories: nutrients.calories || 0,
            carbs: nutrients.carbs || 0,
            protein: nutrients.protein || 0,
            fat: nutrients.fat || 0,
          },
        };
      });

      return res.status(200).json(foods);
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      const { barcode } = body || {};
      if (!barcode) return res.status(400).json({ error: 'No barcode' });

      const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await r.json();
      if (data.status !== 1) return res.status(404).json({ error: 'Product not found' });

      const p = data.product;
      const n = p.nutriments || {};
      return res.status(200).json({
        id: barcode,
        name: p.product_name || 'Unknown',
        brand: p.brands || null,
        serving_size: p.serving_quantity || 100,
        serving_unit: p.serving_quantity_unit || 'g',
        per100g: {
          calories: Math.round(n['energy-kcal_100g'] || 0),
          carbs: Math.round(n.carbohydrates_100g || 0),
          protein: Math.round(n.proteins_100g || 0),
          fat: Math.round(n.fat_100g || 0),
        },
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
