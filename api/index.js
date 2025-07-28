const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio'); // only if you plan to scrape HTML pages

const app = express();
const PORT = process.env.PORT || 3000;
const TMDB_API_KEY = process.env.TMDB_API_KEY || '0c174d60d0fde85c3522abc550ce0b4e';

// ✅ Health check
app.get('/', (req, res) => {
  res.send('✅ Lulacloud API is running!');
});

// ✅ Movie TMDB route
app.get('/api/movie/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const response = await axios.get(`https://api.themoviedb.org/3/movie/${id}`, {
      params: { api_key: TMDB_API_KEY },
    });

    res.json(response.data);
  } catch (err) {
    console.error('❌ Error fetching movie:', err.message);
    res.status(500).json({ error: 'Function crashed', details: err.message });
  }
});

// ✅ Optional extractor if needed for scrapers (sample, not used above)
function extractSubjectId(html, movieTitle) {
  const regex = new RegExp(`"(\\d{16,})",\\s*"${movieTitle}"`);
  const match = html.match(regex);
  return match ? match[1] : null;
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});