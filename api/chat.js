import { supabase } from './supabase.js';

const BASE_SYSTEM_PROMPT = `You are an expert endurance sports coach assistant for HM2L Racing, working alongside coach Travis Terzer. Your role is to help Travis analyze athlete data and prescribe workouts that align with his coaching philosophy and methodology.

COACHING PHILOSOPHY:
- Polarized training model with clear hard/easy separation
- Quality sessions are truly hard, easy sessions are truly easy - no junk miles
- Periodization built around A-race targets with B/C races as training stimulus
- Data-driven decision making using CTL/ATL/TSB as primary load management tools
- Safe ramp rate: 4-6 CTL points/week for athletes under CTL 70, 6-8 for athletes over CTL 70
- TSB target for peak performance: +5 to +25. Training zone: -10 to -30. If TSB below -30 flag overreaching risk.
- Zone distribution targets are HIGHLY dependent on the athlete's primary event and training phase. Use this framework:
  • Sprint/Olympic triathlon or 5K-10K running: more polarized, Z3 is true junk miles, target 75-80% Z1-Z2, 5% Z3, 15-20% Z4+
  • 70.3 / Half marathon: significant threshold work is race-specific, Z3-Z4 IS race pace for most athletes, target 60-70% Z1-Z2, 20-25% Z3-Z4, 10-15% Z4+
  • Full Ironman / Marathon: race pace is Z2-Z3, large aerobic base critical, target 70-80% Z1-Z2, 15-20% Z3, 5-10% Z4+
  • Base phase for any event: shift toward more Z1-Z2 regardless of event
  • Peak/race-specific phase: shift toward event-specific race pace work
  Always consider the athlete's primary event distance and current training phase before commenting on zone distribution. Never flag threshold work as problematic for a 70.3 athlete in build or peak phase.

TRAVIS'S CURRENT WEEKLY STRUCTURE (use as template for similar athletes):
- Monday: Easy 30 min swim + optional yoga/mobility
- Tuesday: Quality run - intervals 1-8 min at 5K to half marathon pace, total session 1:15. Plus 45 min mobility/lift.
- Wednesday: Quality bike - intervals 5-20 min at 80-100% threshold, 30-50 min total work, 2-3 hr session. 20 min brick run at base/tempo off the bike.
- Thursday: Longer swim 4000-5000 yds, structured with drills and slightly harder efforts
- Friday: 60-90 min neuromuscular/cadence drill bike ride (easy). Separate 40-60 min easy run.
- Saturday: Long bike 3+ hrs with slightly longer lower-intensity intervals or similar to Wednesday. 20 min brick run at base/tempo.
- Sunday: 90+ min easy/base long run, steady effort.

HARD DAYS: Tuesday, Wednesday, Saturday
EASY/RECOVERY DAYS: Monday, Thursday (moderate), Friday, Sunday

WHEN PRESCRIBING WORKOUTS:
- Always reference the athlete's current CTL, ATL, TSB and ramp rate before prescribing
- If TSB is below -25, recommend reducing intensity or taking an easy day before next hard session
- If TSB is above +20, athlete is fresh - can handle a hard block
- Adjust weekly TSS targets based on where athlete is in their training cycle
- Always specify: sport, duration, intensity (zone targets), specific intervals if a quality session, and purpose of the session
- Format workout prescriptions clearly with: Session type, Duration, Warm up, Main set, Cool down, Target zones, Coaching notes

ATHLETE DATA CONTEXT:
You will be provided with the athlete's current CTL, ATL, TSB, ramp rate, recent activities, and zone distribution. Always reference this data specifically in your responses. Do not give generic advice - every recommendation should be grounded in the athlete's actual numbers.

You are coaching individual athletes with different backgrounds, limiters, and goals. Never apply a one-size-fits-all philosophy. Always reason from the specific athlete's profile, event, phase, and data.

When the coach asks a question, be direct and specific. Lead with the data insight, then the recommendation.`;

function weeksOut(dateStr) {
  const race = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((race - today) / (7 * 24 * 3600 * 1000));
  return diff;
}

// ─── Activity stream analysis helpers ────────────────────────────────────────

const ANALYSIS_KEYWORDS = /\b(analyz|analys|today['']?s\s+(ride|run|swim|workout|session|bike)|last\s+(ride|run|swim|workout|session)|what\s+did|how\s+was|how\s+did\s+(the|that|today|yesterday)|tell\s+me\s+about\s+(the|today|yesterday|that|this)\s+(ride|run|swim|workout|session)|review|debrief|break\s+down|look\s+at\s+(the|today|yesterday|that|this)\s+(ride|run|swim|workout))\b/i;

function shouldAnalyzeActivity(messages) {
  const text = messages.slice(-4).map(m => m.content || '').join(' ');
  return ANALYSIS_KEYWORDS.test(text);
}

function extractActivityIdFromMessages(messages) {
  const text = messages.map(m => m.content || '').join(' ');
  const m = text.match(/\bi(\d{6,10})\b/);
  return m ? m[0] : null;
}

function detectSportFromMessages(messages) {
  const text = messages.slice(-4).map(m => m.content || '').join(' ').toLowerCase();
  if (/\b(ride|bike|cycling|cyclist|power|watts|watt)\b/.test(text)) return 'cycling';
  if (/\b(run|running|runner|pace|tempo run|long run|jog)\b/.test(text)) return 'running';
  if (/\b(swim|swimming|pool|yards|metres|meters|stroke)\b/.test(text)) return 'swimming';
  return null;
}

function detectDateFromMessages(messages) {
  const text = messages.slice(-4).map(m => m.content || '').join(' ').toLowerCase();
  const today = new Date();
  if (/\btoday\b/.test(text)) return today.toISOString().split('T')[0];
  if (/\byesterday\b/.test(text)) {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    return y.toISOString().split('T')[0];
  }
  return null;
}

function rollingAvg(arr, win) {
  return arr.map((_, i) => {
    const start = Math.max(0, i - win + 1);
    const vals = arr.slice(start, i + 1).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });
}

function extractBlocks(signal, threshold, minBlockSecs, minRestGap) {
  const effort = signal.map(v => (v != null && v >= threshold) ? 1 : 0);
  // Merge short gaps
  for (let i = 1; i < effort.length; i++) {
    if (effort[i] === 0) {
      let end = i;
      while (end < effort.length && effort[end] === 0) end++;
      if (end - i < minRestGap) for (let j = i; j < end; j++) effort[j] = 1;
    }
  }
  const blocks = [];
  let inBlock = false, blockStart = 0;
  for (let i = 0; i <= effort.length; i++) {
    const e = i < effort.length ? effort[i] : 0;
    if (e && !inBlock) { inBlock = true; blockStart = i; }
    else if (!e && inBlock) {
      inBlock = false;
      if (i - blockStart >= minBlockSecs) blocks.push({ start: blockStart, end: i, duration: i - blockStart });
    }
  }
  return blocks;
}

function avgOfSlice(arr, start, end) {
  if (!arr) return null;
  const vals = arr.slice(start, end).filter(v => v != null && v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function secPerMile(mps) {
  if (!mps || mps <= 0) return null;
  const totalSec = Math.round(1609.34 / mps);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')}/mi`;
}

function fmtDur(secs) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return m > 0 ? `${m}m${s > 0 ? s + 's' : ''}` : `${s}s`;
}

function classifySession(blocks, totalSecs, sport, wattsArr, ftp) {
  if (blocks.length === 0) return 'Endurance / steady-state';
  const workSecs = blocks.reduce((a, b) => a + b.duration, 0);
  const restSecs = Math.max(0, totalSecs - workSecs);
  if (sport === 'cycling' && wattsArr && ftp) {
    const valid = wattsArr.filter(v => v != null && v > 20);
    const avg = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
    if (avg / ftp < 0.65 && blocks.length <= 2) return 'Endurance';
    if (avg / ftp >= 0.76 && avg / ftp <= 0.90 && blocks.length <= 2) return 'Tempo';
  }
  if (blocks.length >= 4 && restSecs > workSecs * 0.4) return 'Intervals';
  if (blocks.length >= 2 && blocks.length <= 3) return 'Threshold / tempo';
  return 'Mixed / structured';
}

async function buildActivityAnalysis(athleteRow, ftp, messages) {
  const icuId = athleteRow.intervals_athlete_id;
  const icuKey = athleteRow.intervals_api_key;
  if (!icuId || !icuKey) return null;

  const auth = Buffer.from(`API_KEY:${icuKey}`).toString('base64');
  const icuHdr = { Authorization: `Basic ${auth}`, Accept: 'application/json' };

  // Fetch recent activities
  let activities = [];
  try {
    const oldest = new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const newest = new Date().toISOString().split('T')[0];
    const r = await fetch(
      `https://intervals.icu/api/v1/athlete/${icuId}/activities?oldest=${oldest}&newest=${newest}`,
      { headers: icuHdr }
    );
    if (r.ok) activities = await r.json();
  } catch { return null; }
  if (!Array.isArray(activities) || activities.length === 0) return null;

  // Identify target activity
  let target = null;
  const explicitId = extractActivityIdFromMessages(messages);
  if (explicitId) target = activities.find(a => String(a.id) === explicitId);
  if (!target) {
    const dateHint = detectDateFromMessages(messages);
    const sportHint = detectSportFromMessages(messages);
    let pool = activities;
    if (dateHint) pool = pool.filter(a => (a.start_date_local || '').startsWith(dateHint));
    if (sportHint) pool = pool.filter(a => {
      const t = (a.type || '').toLowerCase();
      if (sportHint === 'cycling') return /ride|cycle|virt/.test(t);
      if (sportHint === 'running') return /run/.test(t);
      if (sportHint === 'swimming') return /swim/.test(t);
      return true;
    });
    target = pool[0] || activities[0];
  }
  if (!target) return null;

  const typeStr = (target.type || '').toLowerCase();
  const sport = typeStr.includes('run') ? 'running' : typeStr.includes('swim') ? 'swimming' : 'cycling';
  const streamTypes = sport === 'cycling'
    ? ['watts', 'heartrate', 'cadence']
    : sport === 'running'
    ? ['velocity_smooth', 'heartrate', 'cadence']
    : ['velocity_smooth', 'heartrate'];

  // Fetch streams: check Supabase cache first, then intervals.icu
  const streams = {};
  for (const st of streamTypes) {
    try {
      const { data: cached } = await supabase
        .from('stream_cache').select('data')
        .eq('activity_id', String(target.id)).eq('stream_type', st).maybeSingle();
      if (cached?.data) { streams[st] = cached.data; continue; }
      const sr = await fetch(
        `https://intervals.icu/api/v1/activity/${target.id}/streams?types=${st}`,
        { headers: icuHdr }
      );
      if (sr.ok) {
        const sd = await sr.json();
        const arr = sd[st] || null;
        if (arr) {
          streams[st] = arr;
          // Fire-and-forget cache write
          supabase.from('stream_cache').upsert(
            { activity_id: String(target.id), stream_type: st, data: arr },
            { onConflict: 'activity_id,stream_type' }
          ).then(() => {});
        }
      }
    } catch { /* stream unavailable */ }
  }

  const totalSecs = target.moving_time || target.elapsed_time || 0;
  let blocks = [];

  if (sport === 'cycling' && streams.watts) {
    const smoothed = rollingAvg(streams.watts, 10);
    const threshold = (ftp || 250) * 0.75;
    blocks = extractBlocks(smoothed, threshold, 30, 20);
    blocks = blocks.map(b => ({
      ...b,
      avgWatts: Math.round(avgOfSlice(streams.watts, b.start, b.end) || 0),
      avgHr: streams.heartrate ? Math.round(avgOfSlice(streams.heartrate, b.start, b.end) || 0) : null,
      avgCad: streams.cadence ? Math.round(avgOfSlice(streams.cadence, b.start, b.end) || 0) : null,
    }));
  } else if (streams.velocity_smooth) {
    const valid = streams.velocity_smooth.filter(v => v != null && v > 0.5);
    if (valid.length) {
      const sorted = [...valid].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length * 0.5)];
      blocks = extractBlocks(streams.velocity_smooth, median * 1.1, 20, 15);
      blocks = blocks.map(b => {
        const avgVel = avgOfSlice(streams.velocity_smooth, b.start, b.end);
        return {
          ...b,
          avgVel,
          paceStr: secPerMile(avgVel),
          avgHr: streams.heartrate ? Math.round(avgOfSlice(streams.heartrate, b.start, b.end) || 0) : null,
          avgCad: streams.cadence ? Math.round(avgOfSlice(streams.cadence, b.start, b.end) || 0) : null,
        };
      });
    }
  }

  const workSecs = blocks.reduce((a, b) => a + b.duration, 0);
  const restSecs = Math.max(0, totalSecs - workSecs);
  const sessionType = classifySession(blocks, totalSecs, sport, streams.watts, ftp);
  const aboveThresholdSecs = (sport === 'cycling' && streams.watts && ftp)
    ? streams.watts.filter(v => v != null && v >= ftp * 0.9).length : 0;

  const dist = target.distance ? (target.distance / 1000).toFixed(2) + 'km' : '—';
  const np = target.normalized_power ? target.normalized_power + 'w' : '—';
  const iff = target.intensity_factor ? target.intensity_factor.toFixed(2) : '—';
  const tss = target.icu_training_load ? Math.round(target.icu_training_load) : '—';

  let out = `\nACTIVITY STREAM ANALYSIS for "${target.name}" on ${(target.start_date_local || '').slice(0, 10)}:\n`;
  out += `Total duration: ${fmtDur(totalSecs)} | Distance: ${dist} | TSS: ${tss} | NP: ${np} | IF: ${iff}\n`;

  if (blocks.length === 0) {
    out += `No distinct effort blocks detected — likely ${sessionType.toLowerCase()} session.\n`;
  } else {
    out += `Effort structure detected:\n`;
    let prevEnd = 0;
    blocks.forEach((b, i) => {
      if (b.start > prevEnd) {
        const restLen = b.start - prevEnd;
        const restAvg = streams.watts ? Math.round(avgOfSlice(streams.watts, prevEnd, b.start) || 0) : null;
        out += `  Rest: ${fmtDur(restLen)}${restAvg ? ` at ${restAvg}w avg` : ''}\n`;
      }
      if (sport === 'cycling') {
        const pct = ftp && b.avgWatts ? Math.round(b.avgWatts / ftp * 100) : null;
        out += `  Effort ${i + 1}: ${fmtDur(b.duration)} at ${b.avgWatts || '—'}w avg`;
        if (pct) out += ` (${pct}% FTP)`;
        if (b.avgHr) out += `, HR ${b.avgHr}bpm avg`;
        if (b.avgCad) out += `, cadence ${b.avgCad}rpm`;
        out += '\n';
      } else {
        out += `  Effort ${i + 1}: ${fmtDur(b.duration)} at ${b.paceStr || '—'} avg`;
        if (b.avgHr) out += `, HR ${b.avgHr}bpm avg`;
        if (b.avgCad) out += `, cadence ${b.avgCad}spm`;
        out += '\n';
      }
      prevEnd = b.end;
    });
  }

  out += `Session type: ${sessionType}\n`;
  if (workSecs > 0 && restSecs > 0) {
    out += `Work:rest ratio: ${(workSecs / restSecs).toFixed(1)}:1\n`;
  }
  if (aboveThresholdSecs > 0) {
    out += `Total time above threshold (90% FTP): ${fmtDur(aboveThresholdSecs)}\n`;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI chat is not configured (missing ANTHROPIC_API_KEY)' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { system, messages, athlete_id, ctl, atl, tsb } = body || {};
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'Missing messages' });

  // Fetch athlete row early — needed for intervals.icu credentials + analysis
  let athleteRow = null;
  if (athlete_id) {
    try {
      const { data } = await supabase.from('athletes').select('id,name,intervals_athlete_id,intervals_api_key').eq('id', athlete_id).maybeSingle();
      athleteRow = data;
    } catch { /* continue */ }
  }

  // Build athlete context block with profile + races
  let athleteContext = '';
  let athleteFtp = null;
  if (athlete_id) {
    try {
      const { data: profile } = await supabase
        .from('athlete_profiles')
        .select('*')
        .eq('athlete_id', athlete_id)
        .maybeSingle();

      if (profile) {
        const wkg = (profile.weight_lbs && profile.ftp_watts)
          ? (profile.ftp_watts / (profile.weight_lbs / 2.205)).toFixed(2)
          : null;
        const heightStr = (profile.height_feet != null && profile.height_inches != null)
          ? `${profile.height_feet}'${profile.height_inches}"`
          : null;
        const parts = [];
        if (profile.age) parts.push(`${profile.age}yo`);
        if (profile.weight_lbs) parts.push(`${profile.weight_lbs}lbs`);
        if (heightStr) parts.push(heightStr);
        if (wkg) parts.push(`${wkg}w/kg`);
        if (profile.experience_level) parts.push(profile.experience_level);
        if (profile.years_training) parts.push(`${profile.years_training} years training`);
        athleteContext += `\nATHLETE PROFILE: ${parts.join(', ')}.`;
        if (profile.max_weekly_hours) athleteContext += ` Available ${profile.max_weekly_hours}hrs/week.`;
        if (profile.available_days_per_week) athleteContext += ` ${profile.available_days_per_week} training days/week.`;
        if (profile.rest_days && profile.rest_days.length) athleteContext += ` Rest days: ${Array.isArray(profile.rest_days) ? profile.rest_days.join(', ') : profile.rest_days}.`;
        if (profile.primary_limiter) athleteContext += ` Primary limiter: ${profile.primary_limiter}.`;
        if (profile.secondary_limiter) athleteContext += ` Secondary limiter: ${profile.secondary_limiter}.`;
        if (profile.current_phase) athleteContext += ` Current phase: ${profile.current_phase}.`;
        if (profile.long_term_goals) athleteContext += ` Goals: ${profile.long_term_goals}.`;
        if (profile.current_injuries) athleteContext += ` Current injuries/niggles: ${profile.current_injuries}.`;
        if (profile.injury_history) athleteContext += ` Injury history: ${profile.injury_history}.`;
        athleteContext += '\n';
        if (profile.ftp_watts) athleteFtp = profile.ftp_watts;
      }
    } catch {
      // profile fetch failed — continue without it
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: races } = await supabase
        .from('races')
        .select('*')
        .eq('athlete_id', athlete_id)
        .gte('race_date', today)
        .order('race_date', { ascending: true })
        .limit(10);

      if (races && races.length > 0) {
        athleteContext += '\nATHLETE UPCOMING RACES:\n';
        races.forEach(r => {
          const wks = weeksOut(r.race_date);
          athleteContext += `- ${r.name} | ${r.race_date} | ${r.distance || 'unknown distance'} | Priority: ${r.priority || '?'} | ${wks} weeks out\n`;
        });

        const nextA = races.find(r => r.priority === 'A');
        if (nextA) {
          const wks = weeksOut(nextA.race_date);
          athleteContext += `\nNEXT A-RACE: ${nextA.name} on ${nextA.race_date} (${wks} weeks out). All periodization and taper planning should be anchored to this date.\n`;
        }
      } else {
        athleteContext += '\nATHLETE UPCOMING RACES: None scheduled.\n';
      }
    } catch {
      // races table may not exist yet — continue without race context
    }
  }

  if (ctl != null || atl != null || tsb != null) {
    athleteContext += '\nATHLETE FITNESS METRICS (from client):';
    if (ctl != null) athleteContext += ` CTL=${ctl}`;
    if (atl != null) athleteContext += ` ATL=${atl}`;
    if (tsb != null) athleteContext += ` TSB=${tsb}`;
    athleteContext += '\n';
  }

  // Inject conversation history
  let historyContext = '';
  if (athlete_id) {
    try {
      const { data: convos } = await supabase
        .from('ai_conversations')
        .select('session_date, messages')
        .eq('athlete_id', athlete_id)
        .order('session_date', { ascending: false })
        .limit(20);

      if (convos && convos.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        // Exclude today's session (that's the live session, not history)
        const pastSessions = convos.filter(c => c.session_date !== today);

        if (pastSessions.length > 0) {
          const recent = pastSessions.slice(0, 5);
          const older = pastSessions.slice(5);

          historyContext += '\n\nPREVIOUS COACHING SESSIONS:\n';
          for (const session of recent) {
            const msgs = Array.isArray(session.messages) ? session.messages : [];
            if (!msgs.length) continue;
            historyContext += `\n--- Session: ${session.session_date} ---\n`;
            for (const m of msgs) {
              const role = m.role === 'user' ? 'Coach' : 'AI';
              historyContext += `${role}: ${m.content}\n`;
            }
          }

          if (older.length > 0) {
            historyContext += '\nCOACHING HISTORY SUMMARY (older sessions):\n';
            for (const session of older) {
              const msgs = Array.isArray(session.messages) ? session.messages : [];
              const userMsgs = msgs.filter(m => m.role === 'user');
              const topics = userMsgs.slice(0, 3).map(m => m.content.slice(0, 120)).join(' | ');
              historyContext += `- ${session.session_date}: ${msgs.length} messages. Topics: ${topics || '(no content)'}\n`;
            }
          }
        }
      }
    } catch {
      // history fetch failed — continue without it
    }
  }

  // Activity stream analysis — runs when coach asks about a specific workout
  let streamAnalysis = '';
  if (athleteRow && shouldAnalyzeActivity(messages)) {
    try {
      streamAnalysis = await buildActivityAnalysis(athleteRow, athleteFtp, messages) || '';
    } catch (e) {
      console.error('[chat] stream analysis error:', e.message);
    }
  }

  const fullSystem = BASE_SYSTEM_PROMPT
    + (athleteContext ? '\n' + athleteContext : '')
    + (historyContext || '')
    + (streamAnalysis ? '\n' + streamAnalysis : '')
    + (system ? '\n\n' + system : '');

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        system: fullSystem,
        messages
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'Anthropic API error' });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reach Anthropic API' });
  }
}
