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

    let htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Download ${title} (${year}) - Lulacloud</title>
      <style>
        body {
          font-family: 'Segoe UI', sans-serif;
          background-color: #f9fafb;
          margin: 0;
          padding: 20px;
          color: #111827;
        }
        .container {
          max-width: 700px;
          margin: 0 auto;
          padding: 2rem;
          background: #fff;
          border-radius: 0.75rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        h1 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 1.25rem;
          text-align: center;
          color: #1f2937;
        }
        .section-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          color: #1f2937;
        }
        .download-button {
          display: block;
          background: #10b981;
          color: white;
          padding: 0.75rem 1rem;
          margin: 0.5rem 0;
          text-align: center;
          text-decoration: none;
          border-radius: 0.5rem;
          transition: background 0.2s ease;
        }
        .download-button:hover {
          background: #059669;
        }
        .sub-button {
          display: inline-block;
          background: #3b82f6;
          color: white;
          padding: 0.6rem 1rem;
          margin: 0.3rem 0.3rem 0 0;
          text-align: center;
          text-decoration: none;
          border-radius: 0.5rem;
          transition: background 0.2s ease;
        }
        .sub-button:hover {
          background: #2563eb;
        }
        footer {
          margin-top: 2rem;
          text-align: center;
          font-size: 0.85rem;
          color: #6b7280;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Download: ${title} (${year})</h1>

        <div class="section-title">🎬 Video Downloads</div>
        ${
          downloads.length
            ? downloads
                .map(dl => {
                  const label = dl.label || 'Unknown Quality';
                  const resolution = dl.resolution || '';
                  const size = dl.size || '';
                  const captions = dl.captions || [];

                  const captionLinks = captions.map(c => {
                    const lang = c.language || 'Subtitle';
                    return `
                      <a class="sub-button" href="${c.url}" target="_blank" rel="noopener noreferrer">
                        ${lang}
                      </a>
                    `;
                  }).join('');

                  return `
                    <div>
                      <a class="download-button" href="${dl.url}" target="_blank" rel="noopener noreferrer">
                        ${label}${resolution ? ' • ' + resolution : ''}${size ? ' • ' + size : ''}
                      </a>
                      ${captions.length ? `<div>${captionLinks}</div>` : ''}
                    </div>
                  `;
                })
                .join('')
            : '<p>No download links available.</p>'
        }

      </div>
      <footer>Powered by Lulacloud × MovieBox API</footer>
    </body>
    </html>
    `;

    res.send(htmlContent);

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).send(`<h2>Internal Server Error</h2><p>${err.message}</p>`);
  }
};
