// ?type=log      — daily_logs table
// ?type=weight   — weight_logs table
// ?type=week     — week_plans table
// ?type=profile  — profiles table (nutrition profile)
import { supabase } from './supabase.js';

const PROFILE_DEFAULTS = {
  weight_lbs: 168,
  goal_weight_lbs: 159,
  mode: 1,
  weekly_loss_target: 0.5,
  protein_factor: 1.09,
  fat_floor: 85,
  fat_ceiling: 110,
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  return body || {};
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const type = req.query.type;
  if (!type) return res.status(400).json({ error: 'Missing ?type=' });

  try {
    // ── LOG ───────────────────────────────────────────────────────
    if (type === 'log') {
      if (req.method === 'GET') {
        const { athlete_id, date } = req.query;
        if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
        if (date) {
          const { data, error } = await supabase
            .from('daily_logs').select('*').eq('athlete_id', athlete_id).eq('log_date', date).maybeSingle();
          if (error) {
            console.error('[nutrition-data GET log single]', error.message, error.details, error.hint);
            return res.status(500).json({ error: error.message, details: error.details, hint: error.hint });
          }
          return res.status(200).json(data || {});
        }
        const { data, error } = await supabase
          .from('daily_logs').select('*').eq('athlete_id', athlete_id)
          .order('log_date', { ascending: false }).limit(30);
        if (error) {
          console.error('[nutrition-data GET log list]', error.message, error.details, error.hint);
          return res.status(500).json({ error: error.message, details: error.details, hint: error.hint });
        }
        return res.status(200).json(data || []);
      }
      if (req.method === 'POST') {
        const body = parseBody(req);
        if (!body.athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
        const { data: existing } = await supabase
          .from('daily_logs').select('id').eq('athlete_id', body.athlete_id).eq('log_date', body.log_date).maybeSingle();
        let result;
        if (existing) {
          result = await supabase.from('daily_logs').update(body).eq('id', existing.id).select('*').single();
        } else {
          result = await supabase.from('daily_logs').insert(body).select('*').single();
        }
        if (result.error) {
          console.error('[nutrition-data POST log]', result.error.message, result.error.details, result.error.hint, '| keys sent:', Object.keys(body));
          return res.status(500).json({ error: result.error.message, details: result.error.details, hint: result.error.hint, keys_sent: Object.keys(body) });
        }
        return res.status(200).json(result.data);
      }
    }

    // ── SCHEMA CHECK ──────────────────────────────────────────────
    if (type === 'schema') {
      if (req.method === 'GET') {
        // Probe whether food_entries column exists by selecting it
        const { error } = await supabase.from('daily_logs').select('food_entries').limit(1);
        if (error) {
          return res.status(200).json({ food_entries_exists: false, probe_error: error.message });
        }
        return res.status(200).json({ food_entries_exists: true });
      }
    }

    // ── WEIGHT ────────────────────────────────────────────────────
    if (type === 'weight') {
      if (req.method === 'GET') {
        const { athlete_id } = req.query;
        if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
        const { data, error } = await supabase
          .from('weight_logs').select('*').eq('athlete_id', athlete_id)
          .order('log_date', { ascending: false }).limit(30);
        if (error) return res.status(500).json([]);
        return res.status(200).json(data || []);
      }
      if (req.method === 'POST') {
        const body = parseBody(req);
        if (!body.athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
        const { data, error } = await supabase.from('weight_logs').insert(body).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
      }
    }

    // ── WEEK ──────────────────────────────────────────────────────
    if (type === 'week') {
      if (req.method === 'GET') {
        const { athlete_id } = req.query;
        if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
        const { data, error } = await supabase
          .from('week_plans').select('*').eq('athlete_id', athlete_id)
          .order('created_at', { ascending: false }).limit(1);
        if (error) return res.status(500).json({ error: error.message });
        if (!data || data.length === 0) return res.status(200).json({ sessions: null });
        return res.status(200).json(data[0]);
      }
      if (req.method === 'POST') {
        const body = parseBody(req);
        if (!body.athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
        const { data, error } = await supabase.from('week_plans').insert(body).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
      }
    }

    // ── PROFILE ───────────────────────────────────────────────────
    if (type === 'profile') {
      if (req.method === 'GET') {
        const { athlete_id } = req.query;
        if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
        const { data, error } = await supabase
          .from('profiles').select('*').eq('athlete_id', athlete_id).limit(1);
        if (error) return res.status(500).json({ error: error.message });
        if (!data || data.length === 0) return res.status(200).json({ ...PROFILE_DEFAULTS, athlete_id });
        return res.status(200).json(data[0]);
      }
      if (req.method === 'POST') {
        const body = parseBody(req);
        const { athlete_id } = body;
        if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
        const { data: existing } = await supabase
          .from('profiles').select('id').eq('athlete_id', athlete_id).limit(1);
        let result;
        if (existing && existing.length > 0) {
          result = await supabase.from('profiles').update(body).eq('athlete_id', athlete_id).select().single();
        } else {
          result = await supabase.from('profiles').insert(body).select().single();
        }
        if (result.error) return res.status(500).json({ error: result.error.message });
        return res.status(200).json(result.data);
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
