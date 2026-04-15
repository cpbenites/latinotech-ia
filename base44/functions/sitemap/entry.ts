import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Procuramos todos os artigos publicados (limite alto para indexação completa)
    const articles = await base44.asServiceRole.entities.NewsArticle.filter(
      { status: 'published' }, 
      '-published_date', 
      5000
    );

    const categories = ["IA", "Gadgets", "Software", "Startups", "Gaming", "Tech", "Tutoriales"];
    const languages = [
      { code: 'es', prefix: '', news: 'noticia' },
      { code: 'pt', prefix: '/br', news: 'noticia' },
      { code: 'en', prefix: '/en', news: 'news' }
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // 1. Páginas Estáticas e de Categorias para cada idioma
    languages.forEach(lang => {
      // Home do idioma
      xml += `
  <url>
    <loc>https://latinotechia.com${lang.prefix}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;
      
      // Categorias do idioma
      categories.forEach(cat => {
        xml += `
  <url>
    <loc>https://latinotechia.com${lang.prefix}/categoria/${cat}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
      });
    });

    // 2. Todos os Artigos Publicados
    articles.forEach(article => {
      const langConfig = languages.find(l => l.code === article.language) || languages[0];
      const url = `https://latinotechia.com${langConfig.prefix}/${langConfig.news}/${article.slug || article.id}`;
      
      const date = article.published_date || article.created_date || new Date().toISOString();
      const lastMod = date.split('T')[0];

      xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
    });

    xml += `\n</urlset>`;

    return new Response(xml, {
      headers: { 
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600' 
      }
    });
  } catch (error) {
    return new Response(`<error>${error.message}</error>`, {
      status: 500,
      headers: { 'Content-Type': 'application/xml' }
    });
  }
});