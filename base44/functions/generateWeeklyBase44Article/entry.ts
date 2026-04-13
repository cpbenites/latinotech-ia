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

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const prompt = `Escreve um artigo otimizado para SEO, com cerca de 600 palavras, sobre como criar negócios digitais, SaaS e automações utilizando a plataforma No-Code Base44. O tom deve ser inspirador, tutorial e focado em empreendedorismo digital. Explica as vantagens de não precisar de programar do zero. 
Gera o artigo em duas línguas: Espanhol (es) e Português (pt).
OBRIGATÓRIO: No último parágrafo de cada artigo, cria um Call-to-Action imperativo a convidar o leitor a testar a plataforma, formatando a hiperligação em Markdown usando estritamente este link exato: [Criar Conta Gratuita na Base44](https://base44.pxf.io/c/7181530/2049275/25619?trafcat=base) (traduz o texto âncora para Espanhol na versão 'es', mas mantém o link rigorosamente igual).`;

        const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    es: { 
                        type: "object", 
                        properties: { 
                            title: { type: "string" }, 
                            summary: { type: "string" }, 
                            content: { type: "string" }, 
                            seo_keywords: { type: "string" } 
                        },
                        required: ["title", "summary", "content", "seo_keywords"]
                    },
                    pt: { 
                        type: "object", 
                        properties: { 
                            title: { type: "string" }, 
                            summary: { type: "string" }, 
                            content: { type: "string" }, 
                            seo_keywords: { type: "string" } 
                        },
                        required: ["title", "summary", "content", "seo_keywords"]
                    },
                    image_prompt: { type: "string" }
                },
                required: ["es", "pt", "image_prompt"]
            }
        });

        let image_url = "";
        try {
            const imgResponse = await base44.asServiceRole.integrations.Core.GenerateImage({
                prompt: llmResponse.image_prompt + ", highly detailed, tech news editorial photography, clean white background, modern tech style, 8k resolution, minimalist"
            });
            image_url = imgResponse.url;
        } catch (e) {
            console.error("Image generation failed:", e);
        }

        const results = [];
        const now = new Date().toISOString();

        for (const lang of ['es', 'pt']) {
            const langData = llmResponse[lang];
            if (!langData || !langData.title) continue;
            
            let baseSlug = generateSlug(langData.title);
            let articleSlug = baseSlug;
            let slugCounter = 2;
            
            while ((await base44.asServiceRole.entities.NewsArticle.filter({ slug: articleSlug })).length > 0) {
                articleSlug = `${baseSlug}-${slugCounter}`;
                slugCounter++;
            }

            const createdArticle = await base44.asServiceRole.entities.NewsArticle.create({
                slug: articleSlug,
                title: langData.title,
                summary: langData.summary,
                content: langData.content,
                image_url: image_url,
                category: "Software",
                status: "published",
                seo_keywords: langData.seo_keywords,
                source_name: "LatinoTech Especial",
                language: lang,
                published_date: now
            });
            
            results.push(createdArticle);
        }

        return Response.json({ success: true, articles: results });
    } catch (error) {
        console.error("Error generating weekly article:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});