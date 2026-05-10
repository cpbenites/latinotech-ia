import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function generateSlug(text) {
    return text.toString().toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 -]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "");
}

const topics = [
    "Inteligencia Artificial en educación en Paraguay",
    "Startups tecnológicas de Paraguay que disrupten América Latina",
    "Herramientas de IA para pequeños negocios en Asunción",
    "Ciberseguridad para empresas paraguayas",
    "Marketing digital con IA en Paraguay",
    "Transformación digital de pymes en Paraguay",
    "Oportunidades de tech en el interior de Paraguay",
    "Blockchain y criptomonedas en Paraguay",
    "IA aplicada a la agricultura en Paraguay",
    "Innovación tecnológica en servicios financieros paraguayos"
];

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const logs = [];

    try {
        const topic = topics[Math.floor(Math.random() * topics.length)];
        logs.push(`Topic: ${topic}`);

        const prompt = `Eres un especialista en tecnología y SEO para el mercado paraguayo. Escribe un artículo completo de 800+ palabras sobre "${topic}".

REQUISITOS:
- Escrito en Español (variante paraguaya/latinoamericana)
- Incluir datos locales, empresas paraguayas o ejemplos de Paraguay cuando sea posible
- SEO optimizado: título con palabra clave principal, subtítulos h2/h3, párrafos cortos
- Incluir tabla comparativa de 3 herramientas/servicios relevantes
- Incluir CTA mencionando oportunidades para Paraguay
- Formato Markdown con negrita, listas, etc.

FORMATO DE RESPUESTA - retorna EXACTAMENTE así:
<article>
<title>TÍTULO AQUI</title>
<summary>RESUMEN DE 2 LINEAS</summary>
<seo_keywords>kw1, kw2, kw3, kw4, kw5</seo_keywords>
<image_prompt>SHORT ENGLISH PROMPT FOR IMAGE</image_prompt>
<content>
CONTENIDO MARKDOWN COMPLETO AQUI
</content>
</article>`;

        logs.push("Llamando LLM...");
        const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: prompt,
            model: "gemini_3_flash"
        });

        const text = typeof response === 'string' ? response : (response.response || JSON.stringify(response));
        logs.push(`LLM response length: ${text.length}`);

        const extractTag = (tag, content) => {
            const m = content.match(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`));
            if (!m) return '';
            return m[0].replace(`<${tag}>`, '').replace(`</${tag}>`, '').trim();
        };

        const title = extractTag('title', text);
        const summary = extractTag('summary', text);
        const seo_keywords = extractTag('seo_keywords', text);
        const image_prompt = extractTag('image_prompt', text);
        const content = extractTag('content', text);

        if (!title || !content) {
            logs.push("Error: Missing title or content");
            return Response.json({ success: false, error: "LLM failed to generate content", logs }, { status: 500 });
        }

        logs.push("Generating image...");
        let image_url = "";
        try {
            const imgResp = await base44.asServiceRole.integrations.Core.GenerateImage({
                prompt: (image_prompt || "tech editorial minimalist Paraguay") + ", 4k, professional"
            });
            image_url = imgResp.url || "";
            logs.push(`Image generated: ${image_url.substring(0, 50)}`);
        } catch (e) {
            logs.push(`Image generation warning: ${e.message}`);
        }

        logs.push("Saving article...");
        let slug = generateSlug(title);
        let finalSlug = slug;
        let counter = 2;
        while ((await base44.asServiceRole.entities.NewsArticle.filter({ slug: finalSlug })).length > 0) {
            finalSlug = `${slug}-${counter}`;
            counter++;
        }

        const created = await base44.asServiceRole.entities.NewsArticle.create({
            slug: finalSlug,
            title: title,
            summary: summary,
            content: content,
            original_url: `https://latinotechia.com/noticia/${finalSlug}`,
            image_url: image_url,
            category: "Tech",
            status: "pending",
            seo_keywords: seo_keywords,
            source_name: "LatinoTech IA - Paraguay Focus",
            language: "es",
            published_date: new Date().toISOString()
        });

        logs.push(`Article created: ${created.id} (${finalSlug})`);
        return Response.json({ success: true, articleId: created.id, slug: finalSlug, logs });

    } catch (error) {
        logs.push(`Fatal error: ${error.message}`);
        return Response.json({ success: false, error: error.message, logs }, { status: 500 });
    }
});