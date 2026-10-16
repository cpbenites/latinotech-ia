import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const BASE_URL = 'https://latinotechia.com';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    const categories = ['IA', 'Gadgets', 'Software', 'Startups', 'Gaming', 'Tech', 'Tutoriales'];
    const urls = [];
    const push = (loc, priority, changefreq) => urls.push({ loc, priority, changefreq });

    // Páginas estáticas e de aterrizagem
    push(`${BASE_URL}/`, '1.0', 'daily');
    push(`${BASE_URL}/privacidad`, '0.3', 'monthly');
    push(`${BASE_URL}/terminos`, '0.3', 'monthly');
    push(`${BASE_URL}/br`, '0.9', 'daily');
    push(`${BASE_URL}/br/privacidad`, '0.3', 'monthly');
    push(`${BASE_URL}/br/terminos`, '0.3', 'monthly');
    push(`${BASE_URL}/en`, '0.9', 'daily');
    push(`${BASE_URL}/en/privacidad`, '0.3', 'monthly');
    push(`${BASE_URL}/en/terminos`, '0.3', 'monthly');

    // Páginas de categoría por idioma
    for (const cat of categories) {
      push(`${BASE_URL}/categoria/${cat}`, '0.6', 'daily');
      push(`${BASE_URL}/br/categoria/${cat}`, '0.6', 'daily');
      push(`${BASE_URL}/en/categoria/${cat}`, '0.6', 'daily');
    }

    // Artículos publicados (paginado)
    let cursor = undefined;
    do {
      const page = await base44.asServiceRole.entities.NewsArticle.filter(
        { status: 'published' },
        {
          sort: '-published_date',
          limit: 500,
          cursor,
          fields: ['slug', 'language', 'published_date', 'updated_date'],
        }
      );

      for (const article of page.items) {
        if (!article.slug) continue;
        let path;
        if (article.language === 'pt') path = `/br/noticia/${article.slug}`;
        else if (article.language === 'en') path = `/en/news/${article.slug}`;
        else path = `/noticia/${article.slug}`;

        const lastmod = (article.updated_date || article.published_date || '').split('T')[0];
        urls.push({
          loc: `${BASE_URL}${path}`,
          lastmod,
          priority: '0.8',
          changefreq: 'monthly',
        });
      }

      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}