const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static('public'));

// Brewfather API proxy
app.all('/api/*', async (req, res) => {
  const userId = req.headers['x-bf-userid'];
  const apiKey = req.headers['x-bf-apikey'];
  if (!userId || !apiKey) return res.status(401).json({ error: 'Missing credentials' });

  const bfPath = req.path.replace(/^\/api/, '');
  const qs = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '';
  const url = `https://api.brewfather.app/v2${bfPath}${qs}`;
  const auth = 'Basic ' + Buffer.from(`${userId}:${apiKey}`).toString('base64');

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
      body: ['PATCH','POST','PUT'].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });
    const text = await response.text();
    res.status(response.status).set('Content-Type', 'application/json').send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gemini vision proxy — reads order screenshots
app.post('/gemini', async (req, res) => {
  const { imageBase64, mimeType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set on server' });

  const prompt = `You are reading a brewing ingredient order confirmation.
Extract all ingredients from this image. Only include fermentables (malts, grains, adjuncts), hops, and yeasts. Do NOT include water treatments, brewing salts, acids, finings, or any other additives.
Return ONLY a JSON array, no explanation, no markdown. Each item should have:
- name (string): the ingredient name
- amount (number): the quantity as a number
- unit (string): the unit, e.g. "g", "kg", "oz", "lb", "pkg"
- type (string): one of "fermentable", "hop", "yeast"

Example output:
[{"name":"Pale Malt","amount":4000,"unit":"g","type":"fermentable"},{"name":"Citra","amount":50,"unit":"g","type":"hop"}]`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } }
            ]
          }]
        })
      }
    );
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Gemini error' });
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    // Strip any markdown code fences just in case
    const clean = text.replace(/```json|```/g, '').trim();
    res.json({ result: clean });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Running'));
