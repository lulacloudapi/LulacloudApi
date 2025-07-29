const https = require('https');
const http = require('http');
const { URL } = require('url');

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url || !url.startsWith('http')) {
    return res.status(400).send('Invalid or missing URL');
  }

  try {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://moviebox.ph/' // ← update if a different referer is required
      }
    };

    lib.get(url, options, (fileRes) => {
      if (fileRes.statusCode !== 200) {
        res.status(fileRes.statusCode).send(`Upstream error: ${fileRes.statusCode}`);
        return;
      }

      res.setHeader('Content-Disposition', `attachment; filename="${parsedUrl.pathname.split('/').pop()}"`);
      res.setHeader('Content-Type', fileRes.headers['content-type'] || 'application/octet-stream');

      fileRes.pipe(res);
    }).on('error', (err) => {
      console.error('Download proxy error:', err.message);
      res.status(500).send('Failed to download file');
    });

  } catch (err) {
    console.error('Proxy handler error:', err.message);
    res.status(500).send('Server error');
  }
}