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
        .order('created_at', { ascending: false })
        .limit(lim ? parseInt(lim) : 50);
      if (error) {
        if (error.code === '42P01') return res.status(200).json({ conversations: [] });
        return res.status(500).json({ error: error.message, code: error.code });
      }
      // Derive session_date from created_at for frontend compatibility
      const conversations = (data || []).map(c => ({
        ...c,
        session_date: c.created_at.slice(0, 10)
      }));
      return res.status(200).json({ conversations });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      body = body || {};
      const { athlete_id, messages } = body;
      if (!athlete_id || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Missing athlete_id or messages' });
      }

      // Find today's record by created_at date range (UTC)
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const todayStart = todayStr + 'T00:00:00.000Z';
      const nextDay = new Date(now);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const tomorrowStart = nextDay.toISOString().slice(0, 10) + 'T00:00:00.000Z';

      const { data: existing } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('athlete_id', athlete_id)
        .gte('created_at', todayStart)
        .lt('created_at', tomorrowStart)
        .maybeSingle();

      let result;
      if (existing) {
        result = await supabase
          .from('ai_conversations')
          .update({ messages })
          .eq('id', existing.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('ai_conversations')
          .insert({ athlete_id, messages })
          .select()
          .single();
      }

      if (result.error) {
        console.error('[ai-conversations POST error]', result.error);
        return res.status(500).json({ error: result.error.message, code: result.error.code, details: result.error.details });
      }
      const conversation = { ...result.data, session_date: result.data.created_at.slice(0, 10) };
      return res.status(200).json({ conversation });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[ai-conversations] unexpected error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
