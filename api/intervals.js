export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { athleteId, apiKey, path } = req.query;
  if (!athleteId || !apiKey || !path) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const url = `https://intervals.icu/api/v1/athlete/${athleteId}/${path}`;
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
