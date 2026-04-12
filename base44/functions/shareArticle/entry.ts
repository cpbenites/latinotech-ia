import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const url = new URL(req.url);
        const slug = url.searchParams.get('slug');
        const lang = url.searchParams.get('lang') || 'es';
        
        if (!slug) {
            return new Response('Missing slug', { status: 400 });
        }
        
        const base44 = createClientFromRequest(req);
        
        let article = null;
        try {
            const articlesBySlug = await base44.asServiceRole.entities.NewsArticle.filter({ slug: slug });
            if (articlesBySlug.length > 0) {
                article = articlesBySlug[0];
            } else {
                article = await base44.asServiceRole.entities.NewsArticle.get(slug);
            }
        } catch (e) {
            console.error(e);
        }
        
        const targetUrl = `https://latinotechia.com${lang === 'pt' ? '/br' : ''}/noticia/${slug}`;
        
        if (!article) {
            return new Response('Article not found', {
                status: 302,
                headers: { 'Location': targetUrl }
            });
        }
        
        const safeTitle = article.title ? article.title.replace(/"/g, '&quot;') : '';
        const safeDesc = article.summary ? article.summary.replace(/"/g, '&quot;') : '';
        const imageUrl = article.image_url || 'https://base44.com/logo_v2.svg';
        
        const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDesc}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:url" content="${targetUrl}">
    <meta property="og:type" content="article">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${imageUrl}">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDesc}">
    <meta http-equiv="refresh" content="0; url=${targetUrl}">
    <title>${safeTitle}</title>
</head>
<body>
    <p>Redirigiendo a la noticia...</p>
    <script>
        window.location.href = "${targetUrl}";
    </script>
</body>
</html>`;

        return new Response(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8'
            }
        });
    } catch (error) {
        return new Response(error.message, { status: 500 });
    }
});