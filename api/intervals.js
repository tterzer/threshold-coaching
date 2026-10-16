export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Strava OAuth token exchange: POST ?service=strava&action=token
  if (req.query.service === 'strava' && req.query.action === 'token') {
    const { code, grant_type, refresh_token } = req.method === 'POST' ? req.body : req.query;
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    if (!clientId || !clientSecret) return res.status(500).json({ error: 'Strava credentials not configured' });
    try {
      const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
      if (grant_type === 'refresh_token') {
        body.set('grant_type', 'refresh_token');
        body.set('refresh_token', refresh_token);
      } else {
        body.set('code', code);
        body.set('grant_type', 'authorization_code');
      }
      const r = await fetch('https://www.strava.com/oauth/token', { method: 'POST', body });
      const data = await r.json();
      return res.status(r.ok ? 200 : 400).json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Strava token exchange failed' });
    }
  }

  // Strava API proxy: GET ?service=strava&path=...&access_token=...
  if (req.query.service === 'strava') {
    const { path, access_token } = req.query;
    if (!path || !access_token) return res.status(400).json({ error: 'Missing path or access_token' });
    const qs = req.query.qs ? `?${req.query.qs}` : '';
    try {
      const r = await fetch(`https://www.strava.com/api/v3/${path}${qs}`, {
        headers: { 'Authorization': `Bearer ${access_token}` }
      });
      const data = await r.json();
      return res.status(r.ok ? 200 : r.status).json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Strava API request failed' });
    }
  }

  // intervals.icu proxy (existing)
  const { athleteId, apiKey, path, base } = req.query;
  if (!athleteId || !apiKey || !path) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Most endpoints hang off /athlete/{athleteId}/..., but some (e.g. activity
  // streams) live directly under /activity/{id}/... with no athlete prefix.
  // Pass base=activity (or any other top-level resource) to target those.
  const url = base
    ? `https://intervals.icu/api/v1/${base}/${path}`
    : `https://intervals.icu/api/v1/athlete/${athleteId}/${path}`;
  const fullUrl = req.query.qs ? `${url}?${req.query.qs}` : url;

  try {
    const credentials = Buffer.from(`API_KEY:${apiKey}`).toString('base64');
    const response = await fetch(fullUrl, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Intervals.icu returned ${response.status}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reach intervals.icu' });
  }
}
