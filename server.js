const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

app.listen(process.env.PORT || 3000, () => console.log('Running'));
