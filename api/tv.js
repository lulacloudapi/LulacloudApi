import axios from 'axios';
import crypto from 'crypto';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '0c174d60d0fde85c3522abc550ce0b4e';
const DRAG_SECRET = process.env.DRAG_SECRET || 'htrbdjsnrbdbbdbsjssgshakdnfkjdfgkdfgkdfgkdfgkdfgkdfgkdfgkdfgkdfgk';

const b64 = str => Buffer.from(str).toString('base64');

function generateDragToken(path, ip, ua) {
  const expires = Date.now() + 60 * 1000;
  const data = `${path}|${ip}|${ua}|${expires}`;
  const hmac = crypto.createHmac('sha256', DRAG_SECRET).update(data).digest('hex');
  return Buffer.from(`${expires}|${hmac}`).toString('base64url');
}

function verifyDragToken(path, token, ip, ua) {
  try {
    const [expires, hmac] = Buffer.from(token, 'base64url').toString().split('|');
    if (Date.now() > Number(expires)) return false;
    const data = `${path}|${ip}|${ua}|${expires}`;
    const expected = crypto.createHmac('sha256', DRAG_SECRET).update(data).digest('hex');
    return hmac === expected;
  } catch {
    return false;
  }
}

function extractSubjectId(html, title) {
  const regex = new RegExp(`"(\\d{16,})",\\s*"[^"]*",\\s*"${title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}"`, 'i');
  const match = html.match(regex);
  return match ? match[1] : null;
}

function extractDetailPathFromHtml(html, subjectId, title) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') + '-';

  const idPattern = new RegExp(`"(${subjectId})"`);
  const idMatch = idPattern.exec(html);
  if (!idMatch) return null;

  const before = html.substring(0, idMatch.index);
  const detailPathRegex = new RegExp(`"((?:${slug})[^"]+)"`, 'gi');
  let match, lastMatch = null;
  while ((match = detailPathRegex.exec(before)) !== null) {
    lastMatch = match[1];
  }
  return lastMatch;
}

function formatSize(bytes) {
  if (!bytes) return '';
  const num = Number(bytes);
  if (num >= 1073741824) return (num / 1073741824).toFixed(2) + ' GB';
  if (num >= 1048576) return (num / 1048576).toFixed(2) + ' MB';
  if (num >= 1024) return (num / 1024).toFixed(2) + ' KB';
  return num + ' B';
}

function dragVerifyPage(redirectUrl) {
  return `
    <html>
    <head>
      <title>Verify You Are Human</title>
     
      <!-- Microsoft Clarity -->
      <script type="text/javascript">
          (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)}
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "ses7z23ih0");
      </script>
      <style>
        body {
          background: #181818;
          color: #fff;
          font-family: Arial, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
        }
        .verify-message {
          background: #1e293b;
          color: #fbbf24;
          border-radius: 10px;
          padding: 18px 24px 16px 24px;
          margin-bottom: 32px;
          font-size: 1.13em;
          box-shadow: 0 2px 8px #0008;
          max-width: 420px;
          text-align: center;
          font-weight: 500;
        }
        .drag-container {
          background: #232323;
          padding: 40px 30px 30px 30px;
          border-radius: 18px;
          box-shadow: 0 2px 12px #000;
          text-align: center;
          min-width: 320px;
        }
        #drag-bar {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          width: 54px;
          background: #2196f3;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2em;
          color: #fff;
          transition: background 0.2s;
          z-index: 2;
        }
        #drag-container {
          background: #111;
          border-radius: 10px;
          width: 320px;
          height: 54px;
          position: relative;
          user-select: none;
          margin: 0 auto 10px auto;
        }
        #drag-container span {
          position: absolute;
          left: 0; right: 0; top: 0; bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #bbb;
          font-size: 1.1em;
          pointer-events: none;
          z-index: 1;
        }
      </style>
    </head>
    <body>
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100vw;height:100vh;">
        <div class="verify-message">
          <b>Why ads?</b> Ads help cover our server costs. Please close any pop-ups and continue to drag the bar below to access your download.
        </div>
        <div class="drag-container">
          <h2 style="margin-bottom:20px;">Drag to Unlock</h2>
          <div id="drag-container">
            <div id="drag-bar">&#8594;</div>
            <span>Drag the blue bar to the right</span>
          </div>
        </div>
      </div>
      <script>
        let dragging = false, startX = 0, currentX = 0;
        const dragBar = document.getElementById('drag-bar');
        const dragContainer = document.getElementById('drag-container');
        dragBar.addEventListener('mousedown', function(e) {
          dragging = true;
          startX = e.clientX;
          document.body.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', function(e) {
          if (!dragging) return;
          currentX = e.clientX - startX;
          if (currentX < 0) currentX = 0;
          if (currentX > 266) currentX = 266;
          dragBar.style.left = currentX + 'px';
          if (currentX >= 266) {
            dragging = false;
            setTimeout(() => {
              window.location.href = '${redirectUrl}';
            }, 200);
          }
        });
        document.addEventListener('mouseup', function() {
          if (!dragging) return;
          if (currentX < 266) {
            dragBar.style.left = '0px';
          }
          dragging = false;
          document.body.style.userSelect = '';
        });
        // Touch support
        dragBar.addEventListener('touchstart', function(e) {
          dragging = true;
          startX = e.touches[0].clientX;
        });
        document.addEventListener('touchmove', function(e) {
          if (!dragging) return;
          currentX = e.touches[0].clientX - startX;
          if (currentX < 0) currentX = 0;
          if (currentX > 266) currentX = 266;
          dragBar.style.left = currentX + 'px';
          if (currentX >= 266) {
            dragging = false;
            setTimeout(() => {
              window.location.href = '${redirectUrl}';
            }, 200);
          }
        });
        document.addEventListener('touchend', function() {
          if (!dragging) return;
          if (currentX < 266) {
            dragBar.style.left = '0px';
          }
          dragging = false;
        });
      </script>
    </body>
    </html>
  `;
}

function rapidApiButtonHtml() {
  return `
    <div style="
      position:fixed;
      right:24px;
      bottom:24px;
      z-index:9999;
      display:flex;
      justify-content:center;
      align-items:center;
      gap:16px;
      box-shadow:0 2px 12px rgba(0,0,0,0.22);
    ">
      <a href="https://rapidapi.com/anakweemmyboy08/api/vidu-movie-download" target="_blank" rel="noopener"
         style="display:flex;align-items:center;text-decoration:none;background:#232323;padding:10px 22px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.18);transition:background 0.2s;">
        <span style="display:inline-block;width:32px;height:32px;margin-right:12px;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
            <circle cx="16" cy="16" r="16" fill="#0097CF"/>
            <path d="M16 7.5c-4.7 0-8.5 3.8-8.5 8.5s3.8 8.5 8.5 8.5 8.5-3.8 8.5-8.5-3.8-8.5-8.5-8.5zm0 15.3c-3.7 0-6.8-3-6.8-6.8s3-6.8 6.8-6.8 6.8 3 6.8 6.8-3 6.8-6.8 6.8zm0-12.1c-2.9 0-5.3 2.4-5.3 5.3s2.4 5.3 5.3 5.3 5.3-2.4 5.3-5.3-2.4-5.3-5.3-5.3z" fill="#fff"/>
          </svg>
        </span>
        <span style="color:#fff;font-size:1.15em;font-weight:bold;letter-spacing:0.5px;">Get your own API here</span>
      </a>
    </div>
  `;
}

export default async function handler(req, res) {
  const { tmdbId, season, episode, drag_token, header } = req.query;

  if (header === '02movie') {
    return res.status(403).send('<h2>Access denied: 02movie is currently disabled</h2>');
  }

  if (!tmdbId || !season || !episode) {
    return res.status(400).send('<h2>Missing tmdbId, season, or episode</h2>');
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';
  const path = `/api/tv?tmdbId=${tmdbId}&season=${season}&episode=${episode}`;

  // Drag verify
  if (!drag_token || !verifyDragToken(path, drag_token, ip, ua)) {
    const token = generateDragToken(path, ip, ua);
    const sep = req.url.includes('?') ? '&' : '?';
    const redirectUrl = `/api/tv?tmdbId=${tmdbId}&season=${season}&episode=${episode}${sep}drag_token=${token}`;
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(dragVerifyPage(redirectUrl));
  }

  // Fallback for TV shows only
  async function getFallbackTvLinks(tmdbId, season, episode) {
    try {
      const resp = await axios.get(`https://dl.vidzee.wtf/download/tv/v4/${tmdbId}/${season}/${episode}`);
      if (resp.data && resp.data.status === "success" && Array.isArray(resp.data.results)) {
        return resp.data;
      }
      return null;
    } catch {
      return null;
    }
  }

  try {
    const tmdbResp = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}`);
    const title = tmdbResp.data.name;
    const year = tmdbResp.data.first_air_date?.split('-')[0];
    const backdropPath = tmdbResp.data.backdrop_path;
    const backdropUrl = backdropPath ? `https://image.tmdb.org/t/p/original${backdropPath}` : '';
    // const searchKeyword = `${title} ${year}`;

    // const searchResp = await axios.get(`https://moviebox.ng/web/searchResult?keyword=${encodeURIComponent(searchKeyword)}`, {
    //   headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    // });

    // const html = searchResp.data;
    // const subjectId = extractSubjectId(html, title);
    // if (!subjectId) {
      const fallbackData = await getFallbackTvLinks(tmdbId, season, episode);
      if (fallbackData && fallbackData.results && fallbackData.results.length) {
        let downloadsHtml = `<h2>Mp4 Downloads (Fallback)</h2>
      <div style="color:orange;font-size:1.15em;margin-bottom:18px;">
        <b>Caution:</b> Large file downloads may use more data. Please check file size before downloading.
      </div>
      <div class="buttons-grid">`;
        fallbackData.results.forEach((item, i) => {
          downloadsHtml += `
        <a href="#" class="btn download" id="fb${i}">
          <span class="quality">${item.title}</span>
          <span class="size">${item.size || ''}</span>
          <span class="dl-label">&#8681; Download</span>
        </a>
      `;
        });
        downloadsHtml += `</div>`;
        const pageHtml = `
          <html>
          <head>
            
            <title>Fallback TV Downloads</title>
            <meta name="google-adsense-account" content="ca-pub-7277962542817557">
            <!-- Google tag (gtag.js) -->
            <script async src="https://www.googletagmanager.com/gtag/js?id=G-90D8L32LZY"></script>
            <script>
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-90D8L32LZY');
            </script>
            <!-- Microsoft Clarity -->
            <script type="text/javascript">
                (function(c,l,a,r,i,t,y){
                    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)}
                    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "ses7z23ih0");
            </script>
            <style>
              body {
                background: url('${backdropUrl}') no-repeat center center fixed;
                background-size: cover;
                color: #fff;
                font-family: Arial, sans-serif;
                text-align: center;
                padding-top: 0;
                user-select: none;
                min-height: 100vh;
                min-width: 100vw;
                width: 100vw;
                height: 100vh;
                overflow: hidden;
              }
              h1 {
                font-size: 2.5em;
                margin-bottom: 10px;
                font-weight: bold;
                text-shadow: 2px 2px 8px #000;
              }
              h2 {
                margin: 30px 0 18px 0;
                font-size: 1.3em;
                font-weight: bold;
                text-shadow: 1px 1px 6px #000;
              }
              .buttons-grid {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 20px;
                margin-bottom: 10px;
              }
              .btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-width: 120px;
                max-width: 180px;
                min-height: 54px;
                margin: 0;
                padding: 10px 10px 8px 10px;
                background: #232323;
                color: #fff;
                border: none;
                border-radius: 12px;
                text-decoration: none;
                font-size: 1em;
                box-shadow: 0 2px 8px rgba(0,0,0,0.25);
                transition: background 0.2s, transform 0.2s;
                cursor: pointer;
                user-select: none;
                word-break: break-word;
              }
              .btn.download .quality, .btn.caption .language {
                font-weight: bold;
                font-size: 1em;
                margin-bottom: 3px;
              }
              .btn .size {
                font-size: 0.95em;
                opacity: 0.9;
                margin-bottom: 3px;
              }
              .btn .dl-label {
                font-size: 0.92em;
                opacity: 0.85;
                margin-top: 2px;
              }
              .btn.download { background: #232323; }
              .btn.caption { background: #232323; }
              .btn:hover { background: #444; transform: scale(1.04);}
              .btn.caption:hover { background: #444; }
              @media (max-width: 900px) {
                .buttons-grid {
                  gap: 12px;
                }
                .btn {
                  min-width: 90px;
                  max-width: 120px;
                  font-size: 0.95em;
                  padding: 8px 4px 6px 4px;
                  min-height: 44px;
                }
              }
              @media (max-width: 600px) {
                .buttons-grid {
                  flex-wrap: wrap;
                  flex-direction: row;
                  justify-content: center;
                  gap: 8px;
                  max-height: none;
                  overflow: visible;
                }
                .btn {
                  min-width: 44vw;
                  max-width: 48vw;
                  font-size: 0.92em;
                  padding: 7px 2vw 6px 2vw;
                  min-height: 38px;
                  margin-bottom: 0;
                  box-sizing: border-box;
                }
                html, body {
                  overflow: hidden !important;
                  height: 100vh !important;
                }
              }
            </style>
          </head>
          <body oncontextmenu="return false;">
            <h1>Fallback TV Downloads</h1>
            ${downloadsHtml}
            ${rapidApiButtonHtml()}
            <noscript>
              <div style="color:red;font-size:1.5em;margin-top:30px;">JavaScript is required to view this page.</div>
            </noscript>
            <script>
              document.querySelectorAll('.btn.download').forEach(btn => {                btn.addEventListener('click', function(e) {
                  e.preventDefault();
                  window.open("https://otieu.com/4/9624620", "_blank");
                });                btn.addEventListener('contextmenu', function(e) {
                  e.preventDefault();
                  window.open("https://otieu.com/4/9624620", "_blank");
                });
              });
            </script>
          </body>
          </html>
        `;
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(pageHtml);
      }
      // If fallback also fails, show 404
      return res.status(404).send('<h2>Series Not Available Yet on lulacloud</h2>');
    // }

    // const detailPath = extractDetailPathFromHtml(html, subjectId, title);
    // const detailsUrl = detailPath ? `https://moviebox.ng/movies/${detailPath}?id=${subjectId}` : null;

    // const downloadResp = await axios.get(`https://moviebox.ng/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}&se=${season}&ep=${episode}`, {
    //   headers: {
    //     'accept': 'application/json',
    //     'user-agent': 'Mozilla/5.0',
    //     'x-client-info': JSON.stringify({ timezone: 'Africa/Lagos' }),
    //     'referer': detailsUrl
    //   }
    // });

    // const data = downloadResp.data?.data || {};
    // const downloads = (data.downloads || []).map(item => ({
    //   ...item,
    //   url: `https://sonix-movies-v3-charlie.vercel.app/download?url=${encodeURIComponent(item.url)}`
    // }));
    // const captions = (data.captions || []).map(c => ({
    //   ...c,
    //   url: c.url,
    //   lan: c.lan,
    //   lanName: c.lanName,
    //   size: c.size
    // }));

    // let downloadsHtml = '';
    // if (downloads.length) {
    //   downloadsHtml += `<h2>Mp4 Downloads </h2><div class="buttons-grid">`;
    //   downloads.forEach((d, i) => {
    //     downloadsHtml += `
    //       <a href="#" class="btn download" data-url="${b64(d.url)}" id="dl${i}">
    //         <span class="quality">${d.resolution ? d.resolution + 'p' : 'Unknown'}</span>
    //         <span class="size">${formatSize(d.size)}</span>
    //         <span class="dl-label">&#8681; Download</span>
    //       </a>
    //     `;
    //   });
    //   downloadsHtml += `</div>`;
    // }

    // let captionsHtml = '';
    // if (captions.length) {
    //   captionsHtml += `<h2>Subtitle Downloads</h2><div class="buttons-grid">`;
    //   captions.forEach((c, i) => {
    //     captionsHtml += `
    //       <a href="#" class="btn caption" data-url="${b64(c.url)}" id="cap${i}">
    //         <span class="language">${c.lanName || c.lan || 'Unknown'}</span>
    //         <span class="size">${formatSize(c.size)}</span>
    //         <span class="dl-label">&#8681; Download</span>
    //       </a>
    //     `;
    //   });
    //   captionsHtml += `</div>`;
    // }

    // const pageHtml = `
    //   <html>
    //   <head>
    //     <script>(s=>{s.dataset.zone='9590821',s.src='https://al5sm.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>
    //     <script src="https://fpyf8.com/88/tag.min.js" data-zone="157990" async data-cfasync="false"></script>
    //     <script src="https://www.googletagmanager.com/gtag/js?id=AW-11445497847" async></script>
    //     <title>${title} (${year}) Downloads - Se ${season} Ep ${episode}</title>
    //     <meta name="google-adsense-account" content="ca-pub-7277962542817557">
    //     <!-- Google tag (gtag.js) -->
    //     <script async src="https://www.googletagmanager.com/gtag/js?id=G-90D8L32LZY"></script>
    //     <script>
    //       window.dataLayer = window.dataLayer || [];
    //       function gtag(){dataLayer.push(arguments);}
    //       gtag('js', new Date());
    //       gtag('config', 'G-90D8L32LZY', {
    //         page_path: '/api/tv?tmdbId=${tmdbId}&season=${season}&episode=${episode}',
    //         page_title: '${title} (${year}) - Season ${season} Episode ${episode} Downloads'
    //       });
    //     </script>
    //     <!-- Microsoft Clarity -->
    //     <script type="text/javascript">
    //         (function(c,l,a,r,i,t,y){
    //             c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)}
    //             t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    //             y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    //         })(window, document, "clarity", "script", "ses7z23ih0");
    //     </script>
    //     <style>
    //       body {
    //         background: url('${backdropUrl}') no-repeat center center fixed;
    //         background-size: cover;
    //         color: #fff;
    //         font-family: Arial, sans-serif;
    //         text-align: center;
    //         padding-top: 0;
    //         user-select: none;
    //         min-height: 100vh;
    //         min-width: 100vw;
    //         width: 100vw;
    //         height: 100vh;
    //         overflow: hidden;
    //       }
    //       h1 {
    //         font-size: 2.5em;
    //         margin-bottom: 10px;
    //         font-weight: bold;
    //         text-shadow: 2px 2px 8px #000;
    //       }
    //       h2 {
    //         margin: 30px 0 18px 0;
    //         font-size: 1.3em;
    //         font-weight: bold;
    //         text-shadow: 1px 1px 6px #000;
    //       }
    //       .buttons-grid {
    //         display: flex;
    //         flex-wrap: wrap;
    //         justify-content: center;
    //         gap: 20px;
    //         margin-bottom: 10px;
    //       }
    //       .btn {
    //         display: flex;
    //         flex-direction: column;
    //         align-items: center;
    //         justify-content: center;
    //         min-width: 120px;
    //         max-width: 180px;
    //         min-height: 54px;
    //         margin: 0;
    //         padding: 10px 10px 8px 10px;
    //         background: #232323;
    //         color: #fff;
    //         border: none;
    //         border-radius: 12px;
    //         text-decoration: none;
    //         font-size: 1em;
    //         box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    //         transition: background 0.2s, transform 0.2s;
    //         cursor: pointer;
    //         user-select: none;
    //         word-break: break-word;
    //       }
    //       .btn.download .quality, .btn.caption .language {
    //         font-weight: bold;
    //         font-size: 1em;
    //         margin-bottom: 3px;
    //       }
    //       .btn .size {
    //         font-size: 0.95em;
    //         opacity: 0.9;
    //         margin-bottom: 3px;
    //       }
    //       .btn .dl-label {
    //         font-size: 0.92em;
    //         opacity: 0.85;
    //         margin-top: 2px;
    //       }
    //       .btn.download { background: #232323; }
    //       .btn.caption { background: #232323; }
    //       .btn:hover { background: #444; transform: scale(1.04);}
    //       .btn.caption:hover { background: #444; }
    //       @media (max-width: 900px) {
    //         .buttons-grid {
    //           gap: 12px;
    //         }
    //         .btn {
    //           min-width: 90px;
    //           max-width: 120px;
    //           font-size: 0.95em;
    //           padding: 8px 4px 6px 4px;
    //           min-height: 44px;
    //         }
    //       }
    //       @media (max-width: 600px) {
    //         .buttons-grid {
    //           flex-wrap: wrap;
    //           flex-direction: row;
    //           justify-content: center;
    //           gap: 8px;
    //           max-height: none;
    //           overflow: visible;
    //         }
    //         .btn {
    //           min-width: 44vw;
    //           max-width: 48vw;
    //           font-size: 0.92em;
    //           padding: 7px 2vw 6px 2vw;
    //           min-height: 38px;
    //           margin-bottom: 0;
    //           box-sizing: border-box;
    //         }
    //         html, body {
    //           overflow: hidden !important;
    //           height: 100vh !important;
    //         }
    //       }
    //     </style>
    //   </head>
    //   <body oncontextmenu="return false;">
    //     <h1>${title} (${year})</h1>
    //     ${downloadsHtml}
    //     ${captionsHtml}
    //     ${(!downloadsHtml && !captionsHtml) ? '<p>No downloads or captions available.</p>' : ''}
    //     ${rapidApiButtonHtml()}
    //     <noscript>
    //       <div style="color:red;font-size:1.5em;margin-top:30px;">JavaScript is required to view this page.</div>
    //     </noscript>
    //     <script>
    //       document.querySelectorAll('.btn').forEach(btn => {
    //         btn.addEventListener('click', function(e) {
    //           e.preventDefault();
    //           const url = atob(this.getAttribute('data-url'));
    //           window.location.href = url;
    //         });
    //         btn.addEventListener('contextmenu', function(e) {
    //           e.preventDefault();
    //         });
    //       });
    //     </script>
    //   </body>
    //   </html>
    // `;
    // res.setHeader('Content-Type', 'text/html');
    // return res.status(200).send(pageHtml);

  } catch (err) {
    return res.status(500).send(`<h2>Error: ${err.message}</h2>`);
  }
}
