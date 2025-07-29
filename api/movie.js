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
          <form action="https://dl.lulacloud.co/download" method="get" target="_blank" onsubmit="return true;">
            <input type="hidden" name="url" value="${rawUrl}" />
            <button type="submit" class="button">Download Subtitle</button>
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
        <title>Download - ${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Inter', sans-serif;
            background: #f0f2f5;
            margin: 0;
            padding: 20px;
            color: #222;
          }
          h1 {
            text-align: center;
            margin-bottom: 30px;
            font-size: 2rem;
          }
          .section {
            margin-bottom: 40px;
          }
          .section h2 {
            font-size: 1.5rem;
            color: #444;
            margin-bottom: 15px;
            border-bottom: 2px solid #ddd;
            padding-bottom: 5px;
          }
          .card {
            background: #fff;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            margin-bottom: 15px;
            transition: transform 0.2s;
            -webkit-user-select: none;
            user-select: none;
          }
          .card:hover {
            transform: translateY(-4px);
          }
          .card h3 {
            margin-top: 0;
            font-size: 1.2rem;
            color: #007BFF;
          }
          .card p {
            margin: 8px 0;
          }
          .button {
            display: inline-block;
            padding: 10px 20px;
            background: #00b894;
            color: #fff;
            font-weight: 600;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            text-align: center;
            text-decoration: none;
            user-select: none;
          }
          .button:hover {
            background: #019874;
          }
          form {
            display: inline-block;
          }
          @media (min-width: 600px) {
            .grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
              gap: 20px;
            }
          }
        </style>
      </head>
      <body>
        <h1>${title} (${year})</h1>

        <div class="section">
          <h2>Video Downloads</h2>
          <div class="grid">
            ${videoLinks || '<p>No downloads found.</p>'}
          </div>
        </div>

        <div class="section">
          <h2>Subtitles</h2>
          <div class="grid">
            ${subtitleLinks || '<p>No subtitles found.</p>'}
          </div>
        </div>

        <script>
          // Disable right-click on forms
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
