const axios = require('axios');

function extractSubjectId(html, movieTitle) {
  const escapedTitle = movieTitle.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(\\d{16,})",\\s*"[^"]*",\\s*"${escapedTitle}"`, 'i');
  const match = html.match(regex);
  return match ? match[1] : null;
}

function extractDetailPathFromHtml(html, subjectId, movieTitle) {
  const slug = movieTitle.trim().toLowerCase().replace(/['’]/g, '')
    .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-';

  const idPattern = new RegExp(`${subjectId}`);
  const idMatch = idPattern.exec(html);
  if (!idMatch) return null;
  const before = html.substring(0, idMatch.index);
  const detailPathRegex = new RegExp(`((?:${slug})[^"]+)`, 'gi');
  let match, lastMatch = null;
  while ((match = detailPathRegex.exec(before)) !== null) {
    lastMatch = match[1];
  }
  return lastMatch;
}

// Base64 encode helper
function b64(str) {
  return Buffer.from(str).toString('base64');
}

module.exports = async (req, res) => {
  const { tmdbId } = req.query;
  const TMDB_API_KEY = process.env.TMDB_API_KEY || '0c174d60d0fde85c3522abc550ce0b4e';

  if (!tmdbId) {
    return res.send('<h2>Error: Missing tmdbId</h2>');
  }

  try {
    const tmdbResp = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`);
    const title = tmdbResp.data.title;
    const year = tmdbResp.data.release_date?.split('-')[0];

    const searchKeyword = `${title} ${year}`;
    const searchUrl = `https://moviebox.ph/web/searchResult?keyword=${encodeURIComponent(searchKeyword)}`;
    const searchResp = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    const html = searchResp.data;
    const subjectId = extractSubjectId(html, title);
    if (!subjectId) {
      return res.send('<h2>Subject ID not found</h2>');
    }

    const detailPath = extractDetailPathFromHtml(html, subjectId, title);
    const detailsUrl = detailPath ? `https://moviebox.ph/movies/${detailPath}?id=${subjectId}` : null;
    const downloadUrl = `https://moviebox.ph/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}&se=0&ep=0`;

    const downloadResp = await axios.get(downloadUrl, {
      headers: {
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0',
        'x-client-info': JSON.stringify({ timezone: 'Africa/Lagos' }),
        'referer': detailsUrl
      }
    });

    const downloads = downloadResp.data?.data?.downloads || [];

    let downloadsHtml = `<div class="download-buttons" style="display: flex; flex-direction: column; gap: 10px;">`;

    downloads.forEach((q, i) => {
      const mainLink = q.url;
      const label = q.quality || 'Unknown';
      const size = q.size || '';
      const subtitle = q.subtitle || ''; // Adjust key if subtitle is in a different property

      downloadsHtml += `
        <a href="#" class="btn download" data-url="${b64(mainLink)}" id="fb${i}" data-ad="false" style="background:#10b981; color:white; padding:10px 15px; border-radius:8px; display:inline-block; text-decoration:none;">
          <span class="quality" style="font-weight:bold;">${label}</span> 
          <span class="size" style="margin-left:10px;">${size}</span>
          ${subtitle ? `<span class="subtitle" style="margin-left:10px; color:#ddd;">[Sub: ${subtitle}]</span>` : ''}
          <span class="dl-label" style="margin-left:15px;">&#8681; Download</span>
        </a>
      `;
    });

    downloadsHtml += `</div>`;

    res.send(`
      <h1>Download Options for ${title} (${year})</h1>
      ${downloadsHtml}
    `);

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).send(`<h2>Internal Server Error</h2><p>${err.message}</p>`);
  }
};
