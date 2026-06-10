import { supabase } from './supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { athlete_id, limit: lim } = req.query;
      if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('athlete_id', athlete_id)
        .order('session_date', { ascending: false })
        .limit(lim ? parseInt(lim) : 50);
      if (error) {
        if (error.code === '42P01') return res.status(200).json({ conversations: [] });
        return res.status(500).json({ error: error.message, code: error.code });
      }
      return res.status(200).json({ conversations: data || [] });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      body = body || {};
      const { athlete_id, session_date, messages } = body;
      if (!athlete_id || !session_date || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Missing athlete_id, session_date, or messages' });
      }

      const { data: existing } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('athlete_id', athlete_id)
        .eq('session_date', session_date)
        .maybeSingle();

      let result;
      if (existing) {
        result = await supabase
          .from('ai_conversations')
          .update({ messages, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('ai_conversations')
          .insert({ athlete_id, session_date, messages })
          .select()
          .single();
      }

      if (result.error) {
        console.error('[ai-conversations POST error]', result.error);
        return res.status(500).json({ error: result.error.message, code: result.error.code, details: result.error.details });
      }
      return res.status(200).json({ conversation: result.data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[ai-conversations] unexpected error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
