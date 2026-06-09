import { supabase } from './supabase.js';

const BASE_SYSTEM_PROMPT = `You are an expert endurance sports coach assistant for HM2L Racing, working alongside coach Travis Terzer. Your role is to help Travis analyze athlete data and prescribe workouts that align with his coaching philosophy and methodology.

COACHING PHILOSOPHY:
- Polarized training model with clear hard/easy separation
- Quality sessions are truly hard, easy sessions are truly easy - no junk miles
- Periodization built around A-race targets with B/C races as training stimulus
- Data-driven decision making using CTL/ATL/TSB as primary load management tools
- Safe ramp rate: 4-6 CTL points/week for athletes under CTL 70, 6-8 for athletes over CTL 70
- TSB target for peak performance: +5 to +25. Training zone: -10 to -30. If TSB below -30 flag overreaching risk.
- Zone distribution target: approximately 80% Z1-Z2, 5% Z3, 15% Z4+

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

When the coach asks a question, be direct and specific. Lead with the data insight, then the recommendation.`;

function weeksOut(dateStr) {
  const race = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((race - today) / (7 * 24 * 3600 * 1000));
  return diff;
}

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

  // Build athlete context block with upcoming races
  let athleteContext = '';
  if (athlete_id) {
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

  const fullSystem = athleteContext
    ? BASE_SYSTEM_PROMPT + '\n' + athleteContext + (system ? '\n\n' + system : '')
    : (system ? BASE_SYSTEM_PROMPT + '\n\n' + system : BASE_SYSTEM_PROMPT);

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
