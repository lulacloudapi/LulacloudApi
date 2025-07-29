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

module.exports = async (req, res) => {
  const { tmdbId } = req.query;
  const TMDB_API_KEY = process.env.TMDB_API_KEY || '0c174d60d0fde85c3522abc550ce0b4e';

  if (!tmdbId) {
    return res.status(400).send('<h2>Missing tmdbId</h2>');
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
      return res.status(404).send('<h2>Subject ID not found</h2>');
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

    const data = downloadResp.data?.data || {};
    const downloads = data.downloads || [];
    const captions = data.captions || [];

    const videoLinks = downloads.map(item => {
      const sizeMB = (parseInt(item.size) / (1024 * 1024)).toFixed(2);
      const rawUrl = item.url; // DO NOT encode
      return `
        <div class="card">
          <h3>${item.resolution}p</h3>
          <p>Size: ${sizeMB} MB</p>
          <form action="/api/proxy-download" method="get" target="_blank">
  <input type="hidden" name="url" value="${item.url}" />
  <button type="submit" class="button">Download</button>
</form>
        </div>
      `;
    }).join('');

    const subtitleLinks = captions.map(sub => {
      const sizeKB = (parseInt(sub.size) / 1024).toFixed(1);
      const rawUrl = sub.url; // DO NOT encode
      return `
        <div class="card">
          <h3>${sub.lanName} (${sub.lan})</h3>
          <p>Size: ${sizeKB} KB</p>
           <form action="/api/proxy-download" method="get" target="_blank">
  <input type="hidden" name="url" value="${sub.url}" />
  <button type="submit" class="button">Download</button>
</form>
        </div>
      `;
    }).join('');

    const htmlResponse = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title} (${year}) Downloads</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      background: url('https://i.imgur.com/O7D2V5N.jpg') no-repeat center center fixed;
      background-size: cover;
      margin: 0;
      padding: 20px;
      color: white;
      text-shadow: 1px 1px 2px #000;
    }

    h1 {
      text-align: center;
      margin-bottom: 40px;
      font-size: 2rem;
    }

    .section {
      margin-bottom: 40px;
      text-align: center;
    }

    .section h2 {
      font-size: 1.3rem;
      margin-bottom: 20px;
      border-bottom: 2px solid rgba(255,255,255,0.3);
      display: inline-block;
      padding: 5px 15px;
    }

    .grid {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 15px;
    }

    .card {
      background: rgba(0, 0, 0, 0.65);
      padding: 15px 20px;
      border-radius: 10px;
      min-width: 200px;
      max-width: 240px;
      transition: transform 0.2s ease;
    }

    .card:hover {
      transform: translateY(-4px);
    }

    .card h3 {
      margin: 0;
      font-size: 1.1rem;
      color: #fff;
    }

    .card p {
      margin: 6px 0 12px;
      font-size: 0.95rem;
    }

    .button {
      display: inline-block;
      padding: 10px 16px;
      background: #111;
      border: 2px solid #fff;
      color: #fff;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      transition: 0.2s ease-in-out;
    }

    .button:hover {
      background: #fff;
      color: #000;
    }

    form {
      margin: 0;
    }
  </style>
</head>
<body>
  <h1>${title} (${year})</h1>

  <div class="section">
    <h2>MKV Downloads (Embedded Subtitles)</h2>
    <div class="grid">
      ${videoLinks
        .split('</div>')
        .filter(card => card.includes('480') && parseFloat(card.match(/(\d+(\.\d+)?) MB/)[1]) < 500)
        .map(card => card + '</div>')
        .join('') || '<p>No MKV downloads.</p>'}
    </div>
  </div>

  <div class="section">
    <h2>Mp4 Downloads (No Subtitles)</h2>
    <div class="grid">
      ${videoLinks
        .split('</div>')
        .filter(card => parseFloat(card.match(/(\d+(\.\d+)?) MB/)[1]) >= 500)
        .map(card => card + '</div>')
        .join('') || '<p>No MP4 downloads.</p>'}
    </div>
  </div>

  <div class="section">
    <h2>Subtitle Downloads</h2>
    <div class="grid">
      ${subtitleLinks || '<p>No subtitles found.</p>'}
    </div>
  </div>

  <script>
    document.addEventListener('contextmenu', function (e) {
      if (e.target.closest('form')) e.preventDefault();
    });
  </script>
  <script data-cfasync="false" async type="text/javascript" src="//fj.detatbulkier.com/rjn7keuwoBa/127530"></script> 
</body>
</html>
`;

    res.send(htmlResponse);
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).send(`<h2>Internal server error</h2><pre>${err.message}</pre>`);
  }
};
