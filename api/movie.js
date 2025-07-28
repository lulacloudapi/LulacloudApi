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

    const htmlResponse = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title} (${year}) - Downloads</title>
      <style>
        body {
          font-family: 'Inter', sans-serif;
          background: #f9f9f9;
          margin: 0;
          padding: 2rem;
        }
        #loading {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(255,255,255,0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          color: #333;
          flex-direction: column;
          z-index: 999;
        }
        #spinner {
          border: 6px solid #f3f3f3;
          border-top: 6px solid #007BFF;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
          margin-bottom: 15px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        h1 { text-align: center; margin-bottom: 30px; font-size: 2rem; }
        .section {
          margin-bottom: 40px;
          display: none;
        }
        .section h2 {
          font-size: 1.5rem;
          color: #444;
          margin-bottom: 15px;
          border-bottom: 2px solid #ddd;
          padding-bottom: 5px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }
        .card {
          background: #fff;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        .card h3 { color: #007BFF; margin: 0 0 8px; }
        .card p { margin: 4px 0; }
        .button {
          display: inline-block;
          padding: 8px 16px;
          background: #007BFF;
          color: white;
          border-radius: 6px;
          text-decoration: none;
          margin-top: 8px;
        }
        .button:hover {
          background: #0056b3;
        }
      </style>
    </head>
    <body>
      <div id="loading">
        <div id="spinner"></div>
        <div>Loading downloads, please wait...</div>
      </div>

      <h1>${title} (${year})</h1>

      <div id="video-section" class="section">
        <h2>Video Downloads</h2>
        <div id="video-list" class="grid"></div>
      </div>

      <div id="subtitle-section" class="section">
        <h2>Subtitles</h2>
        <div id="subtitle-list" class="grid"></div>
      </div>

      <script>
        (async () => {
          try {
            const response = await fetch("/api/movie-download-data?tmdbId=${tmdbId}");
            const result = await response.json();

            if (!result.success) throw new Error(result.error || "Failed to fetch");

            const downloads = result.downloadData.data.downloads || [];
            const captions = result.downloadData.data.captions || [];

            const videoList = document.getElementById('video-list');
            const subtitleList = document.getElementById('subtitle-list');

            downloads.forEach(item => {
              const size = (parseInt(item.size) / (1024 * 1024)).toFixed(2);
              videoList.innerHTML += \`
                <div class="card">
                  <h3>\${item.resolution}p</h3>
                  <p>Size: \${size} MB</p>
                  <a href="\${item.url}" target="_blank" class="button">Download</a>
                </div>
              \`;
            });

            captions.forEach(sub => {
              const size = (parseInt(sub.size) / 1024).toFixed(1);
              subtitleList.innerHTML += \`
                <div class="card">
                  <h3>\${sub.lanName} (\${sub.lan})</h3>
                  <p>Size: \${size} KB</p>
                  <a href="\${sub.url}" target="_blank" class="button">Download Subtitle</a>
                </div>
              \`;
            });

            if (downloads.length) document.getElementById('video-section').style.display = 'block';
            if (captions.length) document.getElementById('subtitle-section').style.display = 'block';
            document.getElementById('loading').style.display = 'none';

          } catch (e) {
            document.getElementById('loading').innerHTML = "<strong>Failed to load download links.</strong>";
          }
        })();
      </script>
    </body>
    </html>
    `;

    res.send(htmlResponse);

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).send(`<h2>Internal server error</h2><pre>${err.message}</pre>`);
  }
};
