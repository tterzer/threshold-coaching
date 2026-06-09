import { supabase } from './supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { activity_id, stream_type } = req.query;
      if (!activity_id || !stream_type) {
        return res.status(400).json({ error: 'Missing activity_id or stream_type' });
      }
      const { data, error } = await supabase
        .from('stream_cache')
        .select('data')
        .eq('activity_id', activity_id)
        .eq('stream_type', stream_type)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ cached: false });
      return res.status(200).json({ cached: true, data: data.data });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      const { activity_id, stream_type, data: streamData } = body || {};
      if (!activity_id || !stream_type || !streamData) {
        return res.status(400).json({ error: 'Missing activity_id, stream_type, or data' });
      }
      // Upsert — safe to call again if already cached
      const { error } = await supabase
        .from('stream_cache')
        .upsert({ activity_id: String(activity_id), stream_type, data: streamData },
                 { onConflict: 'activity_id,stream_type' });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
