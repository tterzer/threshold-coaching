import { supabase } from './supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { athlete_id, date } = req.query;
      if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
      let q = supabase.from('coaching_notes').select('*').eq('athlete_id', athlete_id).order('date', { ascending: false });
      if (date) q = q.eq('date', date);
      const { data, error } = await q;
      if (error) {
        console.error('[coaching-notes GET]', { code: error.code, message: error.message, details: error.details, hint: error.hint });
        if (error.code === '42P01') return res.status(200).json({ notes: [] });
        return res.status(500).json({ error: error.message, code: error.code, details: error.details, hint: error.hint });
      }
      return res.status(200).json({ notes: data });
    }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};

    if (req.method === 'POST') {
      console.log('[coaching-notes POST] body:', JSON.stringify(body));
      const { athlete_id, date, note } = body;
      if (!athlete_id || !date) return res.status(400).json({ error: 'Missing athlete_id or date' });

      // Check for existing row first to avoid needing a unique constraint
      const { data: existing, error: selectError } = await supabase
        .from('coaching_notes')
        .select('id')
        .eq('athlete_id', athlete_id)
        .eq('date', date)
        .maybeSingle();

      if (selectError) {
        console.error('[coaching-notes POST select]', { code: selectError.code, message: selectError.message, details: selectError.details, hint: selectError.hint });
        return res.status(500).json({ error: selectError.message, code: selectError.code, details: selectError.details, hint: selectError.hint });
      }

      console.log('[coaching-notes POST] existing row:', existing);

      let result;
      if (existing) {
        result = await supabase
          .from('coaching_notes')
          .update({ note })
          .eq('id', existing.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('coaching_notes')
          .insert({ athlete_id, date, note })
          .select()
          .single();
      }

      if (result.error) {
        console.error('[coaching-notes POST', existing ? 'update' : 'insert', ']', { code: result.error.code, message: result.error.message, details: result.error.details, hint: result.error.hint });
        return res.status(500).json({ error: result.error.message, code: result.error.code, details: result.error.details, hint: result.error.hint });
      }

      return res.status(200).json({ note: result.data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[coaching-notes] unexpected error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
