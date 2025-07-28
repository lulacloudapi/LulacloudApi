import axios from 'axios';

export default async function handler(req, res) {
  console.log('Request Query:', req.query);
  const { tmdbId, season, episode } = req.query;
  const TMDB_API_KEY = process.env.TMDB_API_KEY;

  if (!TMDB_API_KEY) {
    console.error('❌ TMDB_API_KEY not set');
    return res.status(500).json({ error: 'Missing TMDB_API_KEY' });
  }
  if (!tmdbId || !season || !episode) {
    return res.status(400).json({ error: 'Missing tmdbId, season, or episode' });
  }

  try {
    console.log('Fetching TMDB...');
    const tmdbResp = await axios.get(
      `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}`
    );
    console.log('TMDB Response:', tmdbResp.data);

    const title = tmdbResp.data.name;
    const year = tmdbResp.data.first_air_date?.split('-')[0] || '';
    const searchKeyword = `${title} ${year}`;
    const searchUrl = `https://moviebox.ph/web/searchResult?keyword=${encodeURIComponent(
      searchKeyword
    )}`;

    console.log('Searching MovieBox:', searchUrl);
    const searchResp = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    console.log('Search HTML length:', searchResp.data.length);

    const subjectId = extractSubjectId(searchResp.data, title);
    if (!subjectId) {
      console.error('SubjectId not found');
      return res.status(404).json({ error: 'subjectId not found' });
    }
    console.log('Found subjectId:', subjectId);

    const detailPath = extractDetailPathFromHtml(searchResp.data, subjectId, title);
    const detailsUrl = detailPath
      ? `https://moviebox.ph/movies/${detailPath}?id=${subjectId}`
      : undefined;

    const downloadUrl = `https://moviebox.ph/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}&se=${season}&ep=${episode}`;
    console.log('Fetching download URL:', downloadUrl);

    const downloadResp = await axios.get(downloadUrl, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0',
        'x-client-info': JSON.stringify({ timezone: 'Africa/Lagos' }),
        ...(detailsUrl ? { referer: detailsUrl } : {})
      }
    });
    console.log('Download response data:', downloadResp.data);

    return res.status(200).json({
      success: true,
      title,
      season,
      episode,
      downloadData: downloadResp.data
    });
  } catch (err) {
    console.error('🧨 Handler Error:', err);
    return res.status(500).json({ error: 'Function crashed', details: err.message });
  }
}

// Add extractSubjectId, extractDetailPathFromHtml functions below from your Logic A