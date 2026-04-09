import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Consultamos apenas artigos publicados, usando o asServiceRole para ignorar restrições de permissões
        const articles = await base44.asServiceRole.entities.NewsArticle.filter({ status: 'published' });
        
        const baseUrl = 'https://latinotechia.com';
        const today = new Date().toISOString();

        // Estrutura base do XML de Sitemap
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        // Páginas estáticas com alta prioridade
        xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${today}</lastmod>\n    <priority>1.0</priority>\n  </url>\n`;
        xml += `  <url>\n    <loc>${baseUrl}/privacidad</loc>\n    <lastmod>${today}</lastmod>\n    <priority>0.8</priority>\n  </url>\n`;
        xml += `  <url>\n    <loc>${baseUrl}/terminos</loc>\n    <lastmod>${today}</lastmod>\n    <priority>0.8</priority>\n  </url>\n`;

        // Iterar pelos artigos publicados
        for (const article of articles) {
            const lastMod = article.published_date || article.created_date || today;
            xml += `  <url>\n`;
            xml += `    <loc>${baseUrl}/article/${article.id}</loc>\n`;
            xml += `    <lastmod>${new Date(lastMod).toISOString()}</lastmod>\n`;
            xml += `    <priority>0.6</priority>\n`;
            xml += `  </url>\n`;
        }

        xml += `</urlset>`;

        // Retornar a string XML com os cabeçalhos apropriados
        return new Response(xml, {
            status: 200,
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 's-maxage=3600'
            }
        });
    } catch (error) {
        console.error("Error generating sitemap:", error);
        return new Response('Error generating sitemap', { status: 500 });
    }
});