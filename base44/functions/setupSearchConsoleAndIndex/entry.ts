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

    // STEP 1: Validar as 3 variáveis de ambiente necessárias
    const projectId = Deno.env.get('G_PROJECT_ID');
    const clientEmail = Deno.env.get('G_CLIENT_EMAIL');
    const privateKeyRaw = Deno.env.get('G_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKeyRaw) {
      console.error('[Search Console Setup] Missing required credentials');
      return Response.json({
        status_code: 500,
        error_message: 'Missing G_PROJECT_ID, G_CLIENT_EMAIL, or G_PRIVATE_KEY'
      }, { status: 500 });
    }

    // STEP 2: Montar credenciais
    let serviceAccount;
    try {
      const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
      serviceAccount = {
        type: 'service_account',
        project_id: projectId,
        private_key_id: 'a9320de62e7804732b880c5c10d84a1fc7913327',
        private_key: privateKey,
        client_email: clientEmail,
        client_id: '115726840012809771108',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      };
      console.log('[Search Console Setup] Credentials mounted successfully');
    } catch (error) {
      console.error('[Search Console Setup] Error mounting credentials:', error.message);
      return Response.json({
        status_code: 500,
        error_message: `Erro ao montar credenciais: ${error.message}`,
        stack: error.stack
      }, { status: 500 });
    }

    // STEP 3: Autenticar e adicionar site ao Search Console
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: serviceAccount,
        scopes: [
          'https://www.googleapis.com/auth/webmasters',
          'https://www.googleapis.com/auth/webmasters.readonly',
          'https://www.googleapis.com/auth/indexing'
        ],
      });

      const webmasters = google.webmasters({
        version: 'v3',
        auth,
      });

      const siteUrl = 'https://latinotechia.com/';
      console.log(`[Search Console Setup] Attempting to add site: ${siteUrl}`);

      try {
        const addSiteResponse = await webmasters.sites.add({
          siteUrl: siteUrl,
        });
        console.log('[Search Console Setup] Site added successfully:', addSiteResponse.data);
      } catch (addError) {
        // Se o site já existe, isso vai retornar 409. Não é um erro crítico.
        if (addError.status === 409) {
          console.log('[Search Console Setup] Site already exists in Search Console (409)');
        } else {
          console.warn('[Search Console Setup] Warning adding site:', addError.message);
        }
      }

      // STEP 4: Tentar indexação
      console.log(`[Search Console Setup] Attempting to index URL: ${url}`);

      const indexing = google.indexing({
        version: 'v3',
        auth,
      });

      const indexResponse = await indexing.urlNotifications.publish({
        requestBody: {
          url: url,
          type: 'URL_UPDATED',
        },
      });

      console.log(`[Search Console Setup] URL indexed successfully: ${url}`);

      return Response.json({
        status: 200,
        message: 'Site adicionado ao Search Console e URL enviada ao Google com sucesso!',
        siteAdded: siteUrl,
        urlIndexed: url,
        articleId: articleId
      });
    } catch (apiError) {
      console.error('[Search Console Setup API Error]', {
        message: apiError.message,
        status: apiError.status,
        code: apiError.code,
        details: apiError.response?.data || apiError.toString()
      });

      return Response.json({
        status_code: apiError.status || 500,
        error_message: apiError.message,
        error_details: apiError.response?.data?.error || apiError.response?.data || apiError.message,
        stack: apiError.stack
      }, { status: apiError.status || 500 });
    }
  } catch (error) {
    console.error('[Search Console Setup Fatal Error]', {
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