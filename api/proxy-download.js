import https from 'https';
import http from 'http';
import { URL } from 'url';

export default async function handler(req, res) {
  const { url, filename } = req.query;

  if (!url || !url.startsWith('http')) {
    return res.status(400).send('Invalid or missing URL');
  }

  try {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://moviebox.ph/' // Change if needed
      }
    };

    lib.get(url, options, (fileRes) => {
      if (fileRes.statusCode !== 200) {
        res.status(fileRes.statusCode).send(`Upstream error: ${fileRes.statusCode}`);
        return;
      }

      // Try to extract filename from upstream Content-Disposition
      const disposition = fileRes.headers['content-disposition'];
      let extractedFilename = null;

      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) extractedFilename = match[1];
      }

      // Use custom filename from query if provided, otherwise fallback
      const finalFilename = filename || extractedFilename || parsedUrl.pathname.split('/').pop();

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
