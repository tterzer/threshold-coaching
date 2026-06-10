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

// ── Pass 1: detect all elevated segments (power ≥ 80% FTP for 10+ consecutive seconds)
function detectElevatedSegments(smoothed, ftp) {
  const threshold = (ftp || 250) * 0.80;
  const segments = [];
  let start = null;
  for (let i = 0; i <= smoothed.length; i++) {
    const above = i < smoothed.length && smoothed[i] != null && smoothed[i] >= threshold;
    if (above && start === null) { start = i; }
    else if (!above && start !== null) {
      if (i - start >= 10) segments.push({ start, end: i, duration: i - start });
      start = null;
    }
  }
  return segments;
}

// Merge segments separated by short gaps (< gapSecs) into one
function mergeSegments(segments, gapSecs) {
  if (segments.length === 0) return [];
  const merged = [{ ...segments[0] }];
  for (let i = 1; i < segments.length; i++) {
    const prev = merged[merged.length - 1];
    if (segments[i].start - prev.end <= gapSecs) {
      prev.end = segments[i].end;
      prev.duration = prev.end - prev.start;
    } else {
      merged.push({ ...segments[i] });
    }
  }
  return merged;
}

// ── Pass 2: pattern recognition — group efforts into interval sets
function groupIntoSets(efforts, restGaps) {
  // efforts: array of {duration, avgWatts, avgHr, avgCad, start, end}
  // restGaps: array of rest durations between consecutive efforts
  if (efforts.length < 2) return { sets: [], unmatched: efforts };

  const within25 = (a, b) => Math.abs(a - b) / Math.max(a, b, 1) <= 0.25;

  // Build adjacency: effort i and i+1 are "similar" if duration and rest both within 25%
  const claimed = new Array(efforts.length).fill(false);
  const sets = [];

  for (let i = 0; i < efforts.length; i++) {
    if (claimed[i]) continue;
    const group = [i];
    for (let j = i + 1; j < efforts.length; j++) {
      if (claimed[j]) continue;
      // Check duration similarity vs first effort in group
      const refDur = efforts[group[0]].duration;
      const refRest = restGaps[group[group.length - 1]]; // rest before j
      if (
        within25(efforts[j].duration, refDur) &&
        (refRest == null || restGaps[j - 1] == null || within25(restGaps[j - 1], refRest))
      ) {
        group.push(j);
      }
    }
    if (group.length >= 3) {
      group.forEach(idx => (claimed[idx] = true));
      const avgDur = Math.round(group.reduce((s, idx) => s + efforts[idx].duration, 0) / group.length);
      const avgW = Math.round(group.reduce((s, idx) => s + (efforts[idx].avgWatts || 0), 0) / group.length);
      const avgHr = group[0].avgHr != null
        ? Math.round(group.reduce((s, idx) => s + (efforts[idx].avgHr || 0), 0) / group.length) : null;
      const restIdxs = group.slice(0, -1).map(idx => restGaps[idx]).filter(r => r != null);
      const avgRest = restIdxs.length ? Math.round(restIdxs.reduce((a, b) => a + b, 0) / restIdxs.length) : null;
      sets.push({ type: 'set', count: group.length, avgDur, avgW, avgHr, avgRest, indices: group });
    }
  }

  const unmatched = efforts.filter((_, i) => !claimed[i]);
  return { sets, unmatched };
}

// ── Pass 3: classify unmatched efforts
function classifyUnmatched(unmatched, ftp) {
  const sustained = [];   // single effort > 10 min
  const spikes = [];      // short isolated efforts < 2 min
  const medium = [];      // everything else

  for (const e of unmatched) {
    if (e.duration >= 600) sustained.push(e);
    else if (e.duration < 120) spikes.push(e);
    else medium.push(e);
  }
  return { sustained, spikes, medium };
}

// ── Main session classifier
function classifyOverallSession(sets, sustained, spikes, medium, baseSecs, ftp, wattsArr) {
  const hasSets = sets.length > 0;
  const hasSustained = sustained.length > 0;
  const totalWorkSecs = sets.reduce((s, st) => s + st.avgDur * st.count, 0)
    + sustained.reduce((s, e) => s + e.duration, 0)
    + medium.reduce((s, e) => s + e.duration, 0);
  const avgPwr = wattsArr ? (() => {
    const v = wattsArr.filter(x => x != null && x > 20);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  })() : 0;

  if (hasSets && !hasSustained) return 'Structured intervals';
  if (hasSets && hasSustained) return 'Mixed — intervals + sustained threshold';
  if (!hasSets && hasSustained && sustained.length === 1) return 'Sustained threshold / tempo block';
  if (!hasSets && hasSustained && sustained.length > 1) return 'Multiple threshold blocks';
  if (spikes.length > 0 && totalWorkSecs === 0) return 'Unstructured / endurance with power variations';
  if (ftp && avgPwr / ftp < 0.65) return 'Endurance / base';
  return 'Mixed / unstructured';
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
  const dist = target.distance ? (target.distance / 1000).toFixed(2) + 'km' : '—';
  const np = target.normalized_power ? target.normalized_power + 'w' : '—';
  const iff = target.intensity_factor ? target.intensity_factor.toFixed(2) : '—';
  const tss = target.icu_training_load ? Math.round(target.icu_training_load) : '—';

  let out = `\nACTIVITY STREAM ANALYSIS for "${target.name}" on ${(target.start_date_local || '').slice(0, 10)}:\n`;
  out += `Total duration: ${fmtDur(totalSecs)} | Distance: ${dist} | TSS: ${tss} | NP: ${np} | IF: ${iff}\n`;

  // ── Cycling: full pattern-recognition analysis
  if (sport === 'cycling' && streams.watts) {
    const effectiveFtp = ftp || 250;
    const smoothed = rollingAvg(streams.watts, 10);

    // Pass 1: all elevated segments (≥80% FTP for 10+ s)
    const rawSegments = detectElevatedSegments(smoothed, effectiveFtp);

    // Merge segments with gaps ≤ 45 s into candidate efforts
    const efforts = mergeSegments(rawSegments, 45).map(b => ({
      ...b,
      avgWatts: Math.round(avgOfSlice(streams.watts, b.start, b.end) || 0),
      avgHr: streams.heartrate ? Math.round(avgOfSlice(streams.heartrate, b.start, b.end) || 0) : null,
      avgCad: streams.cadence ? Math.round(avgOfSlice(streams.cadence, b.start, b.end) || 0) : null,
    }));

    // Build rest-gap array (duration of rest between consecutive efforts)
    const restGaps = efforts.map((e, i) =>
      i === 0 ? null : e.start - efforts[i - 1].end
    );

    // Pass 2: pattern recognition
    const { sets, unmatched } = groupIntoSets(efforts, restGaps);

    // Pass 3: classify unmatched
    const { sustained, spikes, medium } = classifyUnmatched(unmatched, effectiveFtp);

    // Base riding = all seconds not in any effort
    const allEffortSecs = efforts.reduce((s, e) => s + e.duration, 0);
    const baseSecs = Math.max(0, totalSecs - allEffortSecs);

    // Overall classification
    const sessionType = classifyOverallSession(sets, sustained, spikes, medium, baseSecs, effectiveFtp, streams.watts);
    out += `Overall session type: ${sessionType}\n\n`;

    // Report structured sets
    sets.forEach((s, i) => {
      const pct = Math.round(s.avgW / effectiveFtp * 100);
      const restStr = s.avgRest ? ` with ${fmtDur(s.avgRest)} recovery` : '';
      out += `Set ${i + 1}: ${s.count} × ~${fmtDur(s.avgDur)} at ~${s.avgW}w (~${pct}% FTP)${restStr}`;
      if (s.avgHr) out += `, avg HR ${s.avgHr}bpm`;
      out += '\n';
    });

    // Report sustained blocks
    sustained.forEach((e, i) => {
      const pct = Math.round(e.avgWatts / effectiveFtp * 100);
      out += `Sustained effort${sustained.length > 1 ? ' ' + (i + 1) : ''}: ${fmtDur(e.duration)} at ${e.avgWatts}w (${pct}% FTP)`;
      if (e.avgHr) out += `, HR ${e.avgHr}bpm avg`;
      out += '\n';
    });

    // Report medium unmatched efforts
    if (medium.length > 0) {
      medium.forEach((e, i) => {
        const pct = Math.round(e.avgWatts / effectiveFtp * 100);
        out += `Effort ${i + 1}: ${fmtDur(e.duration)} at ${e.avgWatts}w (${pct}% FTP)`;
        if (e.avgHr) out += `, HR ${e.avgHr}bpm avg`;
        out += '\n';
      });
    }

    // Report spikes
    if (spikes.length > 0) {
      const avgSpikePwr = Math.round(spikes.reduce((s, e) => s + e.avgWatts, 0) / spikes.length);
      out += `Unstructured power variations: ${spikes.length} spike${spikes.length > 1 ? 's' : ''} (avg ${avgSpikePwr}w, likely terrain/accelerations)\n`;
    }

    // Report base riding
    if (baseSecs > 60) {
      const baseWatts = streams.watts.filter(v => v != null && v > 5);
      const baseAvg = baseWatts.length ? Math.round(baseWatts.reduce((a, b) => a + b, 0) / baseWatts.length) : null;
      const basePct = baseAvg ? Math.round(baseAvg / effectiveFtp * 100) : null;
      out += `Base / endurance riding: ${fmtDur(baseSecs)}`;
      if (baseAvg) out += ` at avg ${baseAvg}w (${basePct}% FTP)`;
      out += '\n';
    }

    // Time above threshold
    const aboveThresholdSecs = streams.watts.filter(v => v != null && v >= effectiveFtp * 0.9).length;
    if (aboveThresholdSecs > 30) {
      out += `Total time ≥90% FTP: ${fmtDur(aboveThresholdSecs)}\n`;
    }

  // ── Run/swim: velocity-based effort recognition
  } else if (streams.velocity_smooth) {
    const valid = streams.velocity_smooth.filter(v => v != null && v > 0.5);
    if (valid.length) {
      const sorted = [...valid].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length * 0.5)];
      const rawSegs = (() => {
        const threshold = median * 1.08;
        const segs = [];
        let start = null;
        for (let i = 0; i <= streams.velocity_smooth.length; i++) {
          const above = i < streams.velocity_smooth.length && streams.velocity_smooth[i] != null && streams.velocity_smooth[i] >= threshold;
          if (above && start === null) start = i;
          else if (!above && start !== null) {
            if (i - start >= 15) segs.push({ start, end: i, duration: i - start });
            start = null;
          }
        }
        return segs;
      })();
      const efforts = mergeSegments(rawSegs, 30).map(b => {
        const avgVel = avgOfSlice(streams.velocity_smooth, b.start, b.end);
        return {
          ...b,
          paceStr: secPerMile(avgVel),
          avgHr: streams.heartrate ? Math.round(avgOfSlice(streams.heartrate, b.start, b.end) || 0) : null,
          avgCad: streams.cadence ? Math.round(avgOfSlice(streams.cadence, b.start, b.end) || 0) : null,
        };
      });

      if (efforts.length === 0) {
        out += 'No distinct pace efforts detected — steady endurance session.\n';
      } else {
        const restGaps = efforts.map((e, i) => i === 0 ? null : e.start - efforts[i - 1].end);
        // Try to find repeating pace sets (same logic, on duration)
        const within25 = (a, b) => Math.abs(a - b) / Math.max(a, b, 1) <= 0.25;
        const claimed = new Array(efforts.length).fill(false);
        const paceSets = [];
        for (let i = 0; i < efforts.length; i++) {
          if (claimed[i]) continue;
          const group = [i];
          for (let j = i + 1; j < efforts.length; j++) {
            if (claimed[j]) continue;
            const refRest = restGaps[group[group.length - 1]];
            if (within25(efforts[j].duration, efforts[group[0]].duration) &&
                (refRest == null || restGaps[j - 1] == null || within25(restGaps[j - 1], refRest))) {
              group.push(j);
            }
          }
          if (group.length >= 3) {
            group.forEach(idx => (claimed[idx] = true));
            const avgDur = Math.round(group.reduce((s, idx) => s + efforts[idx].duration, 0) / group.length);
            const refPace = efforts[group[0]].paceStr;
            const restIdxs = group.slice(0, -1).map(idx => restGaps[idx]).filter(r => r != null);
            const avgRest = restIdxs.length ? Math.round(restIdxs.reduce((a, b) => a + b, 0) / restIdxs.length) : null;
            const avgHr = efforts[group[0]].avgHr != null
              ? Math.round(group.reduce((s, idx) => s + (efforts[idx].avgHr || 0), 0) / group.length) : null;
            paceSets.push({ count: group.length, avgDur, refPace, avgRest, avgHr });
          }
        }
        paceSets.forEach((s, i) => {
          const restStr = s.avgRest ? ` with ${fmtDur(s.avgRest)} recovery` : '';
          out += `Set ${i + 1}: ${s.count} × ~${fmtDur(s.avgDur)} at ~${s.refPace}${restStr}`;
          if (s.avgHr) out += `, avg HR ${s.avgHr}bpm`;
          out += '\n';
        });
        efforts.filter((_, i) => !claimed[i]).forEach((e, i) => {
          out += `Effort ${i + 1}: ${fmtDur(e.duration)} at ${e.paceStr || '—'}`;
          if (e.avgHr) out += `, HR ${e.avgHr}bpm avg`;
          out += '\n';
        });
      }
    } else {
      out += 'Insufficient velocity data for effort analysis.\n';
    }
  } else {
    out += 'No power or velocity stream available for this activity.\n';
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
