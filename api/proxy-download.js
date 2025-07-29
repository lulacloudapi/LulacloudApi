import https from 'https';
import http from 'http';
import { URL } from 'url';

export default async function handler(req, res) {
  const { url, title } = req.query;

  if (!url || !url.startsWith('http')) {
    return res.status(400).send('Invalid or missing URL');
  }

  try {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://moviebox.ph/' // Change as needed
      }
    };

    lib.get(url, options, (fileRes) => {
      if (fileRes.statusCode !== 200) {
        res.status(fileRes.statusCode).send(`Upstream error: ${fileRes.statusCode}`);
        return;
      }

      // Try to extract filename from Content-Disposition if present
      const disposition = fileRes.headers['content-disposition'];
      let filename = null;

      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      // Extract extension from original URL if needed
      const ext = parsedUrl.pathname.split('.').pop().split('?')[0];
      const safeTitle = title ? title.replace(/[^\w\s.-]/g, '') : null;

      const finalFilename = safeTitle
        ? `${safeTitle.trim()}.${ext}`
        : filename || parsedUrl.pathname.split('/').pop();

      res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);
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
