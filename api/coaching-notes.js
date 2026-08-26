import { supabase } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      // Cross-athlete unread workout chat counts (no athlete_id required)
      if (req.query.resource === 'unread-workout-counts') {
        const { data, error } = await supabase
          .from('coaching_notes')
          .select('athlete_id, messages, note, coach_reply');
        if (error) return res.status(500).json({ error: error.message });
        const counts = {};
        (data || []).forEach(row => {
          const msgs = row.messages || [];
          // Only count rows with actual chat messages (not legacy-only rows)
          if (msgs.length > 0 && msgs[msgs.length - 1].sender === 'athlete') {
            counts[row.athlete_id] = (counts[row.athlete_id] || 0) + 1;
          }
        });
        return res.status(200).json({ counts });
      }

      const { athlete_id, date, has_reply } = req.query;
      if (!athlete_id) return res.status(400).json({ error: 'Missing athlete_id' });

      // Coach-written calendar notes
      if (req.query.resource === 'coach-cal-notes') {
        const { data, error } = await supabase
          .from('coach_cal_notes')
          .select('*')
          .eq('athlete_id', athlete_id)
          .order('date', { ascending: true });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ notes: data });
      }

      // Return only dates that have a coach reply (for athlete notification dots)
      if (has_reply) {
        const { data, error } = await supabase
          .from('coaching_notes')
          .select('date, planned_workout_id, coach_reply_at')
          .eq('athlete_id', athlete_id)
          .not('coach_reply_at', 'is', null);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ dates: data });
      }

      // Workout chat thread for a specific date+workout
      if (req.query.resource === 'workout-chat') {
        if (!date) return res.status(400).json({ error: 'Missing date' });
        const { planned_workout_id } = req.query;
        let chatQ = supabase
          .from('coaching_notes')
          .select('messages, note, coach_reply, coach_reply_at')
          .eq('athlete_id', athlete_id)
          .eq('date', date);
        chatQ = planned_workout_id ? chatQ.eq('planned_workout_id', planned_workout_id) : chatQ.is('planned_workout_id', null);
        const { data: chatRow, error: chatErr } = await chatQ.maybeSingle();
        if (chatErr) return res.status(500).json({ error: chatErr.message });
        let messages = (chatRow && chatRow.messages) ? chatRow.messages : [];
        if (!messages.length) {
          if (chatRow && chatRow.note) messages.push({ sender: 'athlete', text: chatRow.note, created_at: null });
          if (chatRow && chatRow.coach_reply) messages.push({ sender: 'coach', text: chatRow.coach_reply, created_at: chatRow.coach_reply_at || null });
        }
        return res.status(200).json({ messages, coach_reply_at: chatRow?.coach_reply_at || null });
      }

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

    // ── Workout chat messages — append a new message to coaching_notes.messages ─
    if (body.resource === 'workout-chat' || req.query.resource === 'workout-chat') {
      if (req.method === 'POST') {
        const { athlete_id, date, sender, text, planned_workout_id } = body;
        if (!athlete_id || !date || !sender || !text) return res.status(400).json({ error: 'Missing params' });
        const now = new Date().toISOString();
        const newMsg = { sender, text, created_at: now };
        let selQ = supabase
          .from('coaching_notes')
          .select('id, messages, note')
          .eq('athlete_id', athlete_id)
          .eq('date', date);
        selQ = planned_workout_id ? selQ.eq('planned_workout_id', planned_workout_id) : selQ.is('planned_workout_id', null);
        const { data: existing, error: selErr } = await selQ.maybeSingle();
        if (selErr) return res.status(500).json({ error: selErr.message });
        const messages = [...((existing && existing.messages) ? existing.messages : []), newMsg];
        const fields = { messages };
        if (sender === 'coach') { fields.coach_reply = text; fields.coach_reply_at = now; }
        if (sender === 'athlete' && !(existing && existing.note)) fields.note = text;
        let result;
        if (existing) {
          result = await supabase.from('coaching_notes').update(fields).eq('id', existing.id).select('messages').single();
        } else {
          const insertRow = { athlete_id, date, ...fields };
          if (planned_workout_id) insertRow.planned_workout_id = planned_workout_id;
          result = await supabase.from('coaching_notes').insert(insertRow).select('messages').single();
        }
        if (result.error) return res.status(500).json({ error: result.error.message });
        return res.status(200).json({ messages: (result.data && result.data.messages) ? result.data.messages : messages });
      }
    }

    // ── Coach calendar notes — must be checked before the generic POST ──────
    if (body.resource === 'coach-cal-notes' || req.query.resource === 'coach-cal-notes') {
      if (req.method === 'POST') {
        const { athlete_id, date, note_text } = body;
        if (!athlete_id || !date) return res.status(400).json({ error: 'Missing athlete_id or date' });
        const { data, error } = await supabase
          .from('coach_cal_notes')
          .insert({ athlete_id, date, note_text: note_text || '' })
          .select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ note: data });
      }
      if (req.method === 'PUT') {
        const { id, note_text } = body;
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const { data, error } = await supabase
          .from('coach_cal_notes')
          .update({ note_text: note_text || '' })
          .eq('id', id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ note: data });
      }
      if (req.method === 'DELETE') {
        const id = body.id || req.query.id;
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const { error } = await supabase.from('coach_cal_notes').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true });
      }
    }

    if (req.method === 'POST') {
      console.log('[coaching-notes POST] body:', JSON.stringify(body));
      const { athlete_id, date, note, coach_reply } = body;
      if (!athlete_id || !date) return res.status(400).json({ error: 'Missing athlete_id or date' });
      const fields = {};
      if (note !== undefined) fields.note = note;
      if (coach_reply !== undefined) {
        fields.coach_reply = coach_reply;
        fields.coach_reply_at = coach_reply ? new Date().toISOString() : null;
      }
      if (!Object.keys(fields).length) return res.status(400).json({ error: 'No fields to update' });

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
          .update(fields)
          .eq('id', existing.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('coaching_notes')
          .insert({ athlete_id, date, ...fields })
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
