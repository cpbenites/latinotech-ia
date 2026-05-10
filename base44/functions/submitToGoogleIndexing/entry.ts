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

    // STEP 1: Parse robusto da variável de ambiente
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!serviceAccountJson) {
      console.error('[Google Indexing] Service account JSON not configured');
      return Response.json({ 
        status_code: 500, 
        error_message: 'Variável GOOGLE_SERVICE_ACCOUNT_JSON está vazia ou não foi encontrada no servidor.' 
      }, { status: 500 });
    }

    let serviceAccount;
    try {
      // Fix quebras de linha na chave privada
      const cleanedJson = serviceAccountJson.replace(/\\n/g, '\n');
      serviceAccount = JSON.parse(cleanedJson);
      console.log('[Google Indexing] Service account parsed successfully');
    } catch (parseError) {
      console.error('[Google Indexing] JSON parse error:', parseError.message);
      return Response.json({ 
        status_code: 500,
        error_message: `Failed to parse service account JSON: ${parseError.message}`,
        stack: parseError.stack
      }, { status: 500 });
    }

    // STEP 2: Try/catch na autenticação e chamada da API Google
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: serviceAccount,
        scopes: ['https://www.googleapis.com/auth/indexing'],
      });

      const indexing = google.indexing({
        version: 'v3',
        auth,
      });

      console.log(`[Google Indexing] Submitting URL: ${url}`);

      const response = await indexing.urlNotifications.publish({
        requestBody: {
          url: url,
          type: 'URL_UPDATED',
        },
      });

      console.log(`[Google Indexing] Article ${articleId} submitted successfully: ${url}`);

      return Response.json({
        success: true,
        message: 'URL submitted to Google Indexing API',
        url: url,
        articleId: articleId,
      });
    } catch (apiError) {
      console.error('[Google Indexing API Error]', {
        message: apiError.message,
        status: apiError.status,
        code: apiError.code,
        details: apiError.response?.data || apiError.toString()
      });
      return Response.json({
        status_code: 500,
        error_message: `Google API Error: ${apiError.message}`,
        details: apiError.response?.data || apiError.message,
        stack: apiError.stack
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[Google Indexing Fatal Error]', {
      message: error.message,
      stack: error.stack
    });
    return Response.json({
      status_code: 500,
      error_message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});