const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Serve the frontend
app.use(express.static('public'));

// Proxy all Brewfather API requests
app.all('/api/*', async (req, res) => {
  const userId = req.headers['x-bf-userid'];
  const apiKey = req.headers['x-bf-apikey'];

  if (!userId || !apiKey) {
    return res.status(401).json({ error: 'Missing credentials' });
  }

  // Strip /api prefix and forward to Brewfather
  const bfPath = req.path.replace(/^\/api/, '');
  const queryString = Object.keys(req.query).length
    ? '?' + new URLSearchParams(req.query).toString()
    : '';
  const url = `https://api.brewfather.app/v2${bfPath}${queryString}`;

  const authHeader = 'Basic ' + Buffer.from(`${userId}:${apiKey}`).toString('base64');

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: ['PATCH', 'POST', 'PUT'].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });

    const text = await response.text();
    res.status(response.status);
    res.set('Content-Type', 'application/json');
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Brewfather proxy running on port ${PORT}`));
