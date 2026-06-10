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

function fmtDur(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h${m > 0 ? m + 'm' : ''}`;
  return m > 0 ? `${m}m${s > 0 ? s + 's' : ''}` : `${s}s`;
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
    ? ['watts', 'heartrate']
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
          supabase.from('stream_cache').upsert(
            { activity_id: String(target.id), stream_type: st, data: arr },
            { onConflict: 'activity_id,stream_type' }
          ).then(() => {});
        }
      }
    } catch { /* stream unavailable */ }
  }

  const totalSecs = target.moving_time || target.elapsed_time || 0;
  const dist = target.distance ? (target.distance / 1000).toFixed(2) + 'km' : '—';
  const tss = target.icu_training_load ? Math.round(target.icu_training_load) : '—';

  let out = `\nACTIVITY DATA for "${target.name}" on ${(target.start_date_local || '').slice(0, 10)}:\n`;
  out += `Duration: ${fmtDur(totalSecs)} | Distance: ${dist} | TSS: ${tss}`;
  if (ftp) out += ` | Athlete FTP: ${ftp}w`;
  out += '\n\n';

  const coachPrompt = `You are an experienced triathlon coach. Here is the raw power data (watts) from a training ride recorded every second. Look at it exactly like you would glance at a power file in TrainingPeaks. Tell me what the athlete did in plain English - warmup, main set, cooldown. What were the intervals if any? How long, how hard, how many? Don't analyze the numbers mathematically. Just describe what you see the way a coach would.`;

  if (sport === 'cycling' && streams.watts) {
    out += `Watts: ${JSON.stringify(streams.watts)}\n`;
    if (streams.heartrate) out += `Heart rate: ${JSON.stringify(streams.heartrate)}\n`;
    out += `\n${coachPrompt}`;
  } else if (streams.velocity_smooth) {
    out += `Velocity (m/s): ${JSON.stringify(streams.velocity_smooth)}\n`;
    if (streams.heartrate) out += `Heart rate: ${JSON.stringify(streams.heartrate)}\n`;
    out += `\n${coachPrompt}`;
  } else {
    return null;
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
        .select('created_at, messages')
        .eq('athlete_id', athlete_id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (convos && convos.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        // Exclude today's session (that's the live session, not history)
        const pastSessions = convos.filter(c => c.created_at.slice(0, 10) !== today);

        if (pastSessions.length > 0) {
          const recent = pastSessions.slice(0, 5);
          const older = pastSessions.slice(5);

          historyContext += '\n\nPREVIOUS COACHING SESSIONS:\n';
          for (const session of recent) {
            const msgs = Array.isArray(session.messages) ? session.messages : [];
            if (!msgs.length) continue;
            const sessionDate = session.created_at.slice(0, 10);
            historyContext += `\n--- Session: ${sessionDate} ---\n`;
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
              const sessionDate = session.created_at.slice(0, 10);
              historyContext += `- ${sessionDate}: ${msgs.length} messages. Topics: ${topics || '(no content)'}\n`;
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
