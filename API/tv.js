const axios = require('axios');

function extractSubjectId(html, movieTitle) {
  const regex = new RegExp("(\\d{16,})",\\s*"[^"]*",\\s*"${movieTitle.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}", 'i');
  const match = html.match(regex);
  return match ? match[1] : null;
}

function extractDetailPathFromHtml(html, subjectId, movieTitle) {
  const slug = movieTitle
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') + '-';

  const idPattern = new RegExp("(${subjectId})");
  const idMatch = idPattern.exec(html);
  if (!idMatch) return null;
  const before = html.substring(0, idMatch.index);
  const detailPathRegex = new RegExp("((?:${slug})[^"]+)", 'gi');
  let match, lastMatch = null;
  while ((match = detailPathRegex.exec(before)) !== null) {
    lastMatch = match[1];
  }
  return lastMatch;
}

module.exports = async (req, res) => {
  const { tmdbId, season, episode } = req.query;
  const TMDB_API_KEY = process.env.TMDB_API_KEY || '0c174d60d0fde85c3522abc550ce0b4e'; // Replace with your TMDb API key

  if (!tmdbId  !season  !episode) {
    return res.status(400).json({ success: false, error: 'Missing tmdbId, season, or episode' });
  }

  try {
    const tmdbResp = await axios.get(https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY});
    const title = tmdbResp.data.name;
    const year = tmdbResp.data.first_air_date?.split('-')[0];

    const searchKeyword = ${title} ${year};
    const searchUrl = https://moviebox.ph/web/searchResult?keyword=${encodeURIComponent(searchKeyword)};

    const searchResp = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    const html = searchResp.data;

    const subjectId = extractSubjectId(html, title);
    if (!subjectId) {
      return res.status(404).json({ success: false, error: 'subjectId not found in HTML' });
    }

    const detailPath = extractDetailPathFromHtml(html, subjectId, title);
    const detailsUrl = detailPath ? https://moviebox.ph/movies/${detailPath}?id=${subjectId} : null;

    const downloadUrl = https://moviebox.ph/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}&se=${season}&ep=${episode};

    const downloadResp = await axios.get(downloadUrl, {
      headers: {
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0',
        'x-client-info': JSON.stringify({ timezone: 'Africa/Lagos' }),
        'referer': detailsUrl
      }
    });

    return res.json({
      success: true,
      title,
      season,
      episode,
      downloadData: downloadResp.data
    });

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};