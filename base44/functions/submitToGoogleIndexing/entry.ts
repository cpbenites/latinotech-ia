import { google } from 'npm:googleapis@135.0.0';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { url, articleId } = await req.json();

    if (!url) {
      return Response.json({ error: 'URL is required' }, { status: 400 });
    }

    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!serviceAccountJson) {
      return Response.json({ error: 'Service account not configured' }, { status: 500 });
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });

    const indexing = google.indexing({
      version: 'v3',
      auth,
    });

    const response = await indexing.urlNotifications.publish({
      requestBody: {
        url: url,
        type: 'URL_UPDATED',
      },
    });

    console.log(`[Google Indexing] Article ${articleId} submitted: ${url}`);

    return Response.json({
      success: true,
      message: 'URL submitted to Google Indexing API',
      url: url,
    });
  } catch (error) {
    console.error('[Google Indexing Error]', error.message);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
});