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

    if (!projectId) {
      console.error('[Google Indexing] G_PROJECT_ID não configurada');
      return Response.json({ 
        status_code: 500, 
        error_message: 'Variável G_PROJECT_ID está vazia ou não foi encontrada no servidor.' 
      }, { status: 500 });
    }

    if (!clientEmail) {
      console.error('[Google Indexing] G_CLIENT_EMAIL não configurada');
      return Response.json({ 
        status_code: 500, 
        error_message: 'Variável G_CLIENT_EMAIL está vazia ou não foi encontrada no servidor.' 
      }, { status: 500 });
    }

    if (!privateKeyRaw) {
      console.error('[Google Indexing] G_PRIVATE_KEY não configurada');
      return Response.json({ 
        status_code: 500, 
        error_message: 'Variável G_PRIVATE_KEY está vazia ou não foi encontrada no servidor.' 
      }, { status: 500 });
    }

    // STEP 2: Reconstruir objeto de credenciais com fix de quebras de linha
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
      console.log('[Google Indexing] Service account credentials mounted successfully');
      console.log('[Google Indexing] Using client_email:', serviceAccount.client_email);
    } catch (error) {
      console.error('[Google Indexing] Error mounting credentials:', error.message);
      return Response.json({
        status_code: 500,
        error_message: `Erro ao montar credenciais: ${error.message}`,
        stack: error.stack
      }, { status: 500 });
    }

    // STEP 3: Autenticação e envio para Google Indexing API
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
        status: 200,
        message: 'URL enviada ao Google com sucesso!'
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