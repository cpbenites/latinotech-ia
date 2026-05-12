import { google } from 'npm:googleapis@135.0.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clientEmail = Deno.env.get('G_CLIENT_EMAIL');
    const privateKeyRaw = Deno.env.get('G_PRIVATE_KEY');
    const projectId = Deno.env.get('G_PROJECT_ID');

    if (!clientEmail || !privateKeyRaw || !projectId) {
      return Response.json({ error: 'Missing credentials' }, { status: 500 });
    }

    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
    const serviceAccount = {
      type: 'service_account',
      project_id: projectId,
      private_key: privateKey,
      client_email: clientEmail,
    };

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    const searchconsole = google.searchconsole({ version: 'v1', auth });

    const siteUrl = 'https://latinotechia.com/';
    console.log(`[Indexing Errors] Fetching URL inspection data for: ${siteUrl}`);

    // Buscar lista de URLs via Search Analytics (páginas com impressões recentes)
    // e também via sitemaps para verificar erros
    let results = {};

    // 1. Listar sitemaps e seus erros
    try {
      const sitemapsResp = await searchconsole.sitemaps.list({ siteUrl });
      const sitemaps = sitemapsResp.data.sitemap || [];
      console.log(`[Indexing Errors] Found ${sitemaps.length} sitemaps`);

      const sitemapDetails = sitemaps.map(s => ({
        path: s.path,
        lastSubmitted: s.lastSubmitted,
        isPending: s.isPending,
        isSitemapsIndex: s.isSitemapsIndex,
        lastDownloaded: s.lastDownloaded,
        warnings: s.warnings,
        errors: s.errors,
        contents: s.contents?.map(c => ({
          type: c.type,
          submitted: c.submitted,
          indexed: c.indexed,
        }))
      }));

      results.sitemaps = sitemapDetails;
    } catch (e) {
      console.warn('[Indexing Errors] Sitemaps error:', e.message);
      results.sitemaps_error = e.message;
    }

    // 2. Search Analytics - páginas com cliques nos últimos 28 dias
    try {
      const analyticsResp = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          dimensions: ['page'],
          rowLimit: 50,
          dimensionFilterGroups: [],
        },
      });

      const rows = analyticsResp.data.rows || [];
      results.pages_with_traffic = rows.length;
      results.top_pages = rows.slice(0, 20).map(r => ({
        page: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: (r.ctr * 100).toFixed(2) + '%',
        position: r.position?.toFixed(1),
      }));
      console.log(`[Indexing Errors] Found ${rows.length} pages with traffic`);
    } catch (e) {
      console.warn('[Indexing Errors] Search Analytics error:', e.message);
      results.analytics_error = e.message;
    }

    // 3. Verificar status de indexação de URLs críticas via URL Inspection API
    const urlsToCheck = [
      'https://latinotechia.com/',
      'https://latinotechia.com/noticia/xrq-73-y-las-tecnologias-que-estan-redefiniendo-la-aviacion-en-mayo-de-2026',
    ];

    const inspectionResults = [];
    for (const urlToInspect of urlsToCheck) {
      try {
        const inspectResp = await searchconsole.urlInspection.index.inspect({
          requestBody: {
            inspectionUrl: urlToInspect,
            siteUrl: siteUrl,
          },
        });
        const result = inspectResp.data.inspectionResult;
        inspectionResults.push({
          url: urlToInspect,
          verdict: result?.indexStatusResult?.verdict,
          coverageState: result?.indexStatusResult?.coverageState,
          robotsTxtState: result?.indexStatusResult?.robotsTxtState,
          indexingState: result?.indexStatusResult?.indexingState,
          lastCrawlTime: result?.indexStatusResult?.lastCrawlTime,
          pageFetchState: result?.indexStatusResult?.pageFetchState,
          googleCanonical: result?.indexStatusResult?.googleCanonical,
          userCanonical: result?.indexStatusResult?.userCanonical,
        });
        console.log(`[Indexing Errors] Inspected ${urlToInspect}: ${result?.indexStatusResult?.verdict}`);
      } catch (e) {
        inspectionResults.push({ url: urlToInspect, error: e.message, code: e.status });
        console.warn(`[Indexing Errors] Inspection error for ${urlToInspect}:`, e.message);
      }
    }
    results.url_inspections = inspectionResults;

    return Response.json({ success: true, data: results });
  } catch (error) {
    console.error('[Indexing Errors Fatal]', error.message, error.stack);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});