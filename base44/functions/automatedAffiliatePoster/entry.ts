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

        // Admins podem testar manualmente com um affiliateId específico
        let body = {};
        try { body = await req.json(); } catch (_) {}
        const { affiliateId } = body;

        let affiliate;

        if (affiliateId) {
            // Teste manual: usa o afiliado especificado
            affiliate = await base44.asServiceRole.entities.AffiliateProgram.get(affiliateId);
        } else {
            // Cron: busca o afiliado ativo com last_published mais antigo
            const allActive = await base44.asServiceRole.entities.AffiliateProgram.filter({ active: true }, 'last_published', 100);
            if (!allActive || allActive.length === 0) {
                return Response.json({ success: true, message: "Nenhum afiliado ativo encontrado." });
            }
            affiliate = allActive[0];
        }

        const prompt = `Você é um redator especialista em Marketing de Conteúdo e SEO para um portal de tecnologia chamado LatinoTech IA.
        
Escreva um artigo de blog de alta qualidade, educativo e em formato de tutorial (Native Advertising) sobre a ferramenta: "${affiliate.name}".
${affiliate.description ? `Contexto da ferramenta: ${affiliate.description}` : ''}

O artigo deve:
1. Ter um título atrativo e otimizado para SEO
2. Apresentar 3 casos de uso práticos e reais
3. Ser educativo e genuinamente útil para o leitor
4. Incluir OBRIGATORIAMENTE o link de afiliado "${affiliate.affiliate_url}" em DOIS momentos distintos:
   - No meio do artigo, dentro de um contexto natural
   - No final, com um CTA forte e convincente
5. Ter entre 600 e 800 palavras por versão
6. Tom profissional, mas acessível

Gere o artigo em 3 idiomas: Espanhol (es), Português (pt) e Inglês (en).

IMPORTANTE: Use Markdown para formatação (## para subtítulos, **negrito**, listas com -).`;

        const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt,
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
                    en: {
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
                required: ["es", "pt", "en", "image_prompt"]
            }
        });

        // Gerar imagem
        let image_url = "";
        try {
            const imgResponse = await base44.asServiceRole.integrations.Core.GenerateImage({
                prompt: llmResponse.image_prompt + ", modern tech tool, editorial photography, clean white background, minimalist, 1080p"
            });
            image_url = imgResponse.url;
        } catch (e) {
            console.error("Image generation failed:", e);
        }

        const now = new Date().toISOString();
        const createdArticles = {};

        for (const lang of ['es', 'pt', 'en']) {
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
                image_url,
                category: "Software",
                status: "published",
                seo_keywords: langData.seo_keywords,
                source_name: `LatinoTech Afiliados - ${affiliate.name}`,
                language: lang,
                published_date: now
            });

            createdArticles[lang] = createdArticle;
        }

        // Atualizar last_published do afiliado
        await base44.asServiceRole.entities.AffiliateProgram.update(affiliate.id, {
            last_published: now
        });

        // Enviar para canais Telegram
        try {
            const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
            const chatIds = {
                es: Deno.env.get("TELEGRAM_CHAT_ID") || "@latinotech",
                pt: "@latinotechbr",
                en: "@latinotechen"
            };

            if (TELEGRAM_BOT_TOKEN) {
                for (const lang of ['es', 'pt', 'en']) {
                    const article = createdArticles[lang];
                    const langData = llmResponse[lang];
                    const chatId = chatIds[lang];

                    if (chatId && article && langData) {
                        const shortSummary = langData.summary.length > 150
                            ? langData.summary.substring(0, 147) + "..."
                            : langData.summary;

                        let urlPath = `/noticia/${article.slug}`;
                        if (lang === 'pt') urlPath = `/br/noticia/${article.slug}`;
                        if (lang === 'en') urlPath = `/en/news/${article.slug}`;

                        const cta = lang === 'pt' ? 'Leia o artigo completo:' : lang === 'en' ? 'Read the full article:' : 'Lee el artículo completo:';
                        const telegramMessage = `<b>${langData.title}</b>\n\n${shortSummary}\n\n🚀 ${cta}\nhttps://latinotechia.com${urlPath}`;

                        const endpoint = image_url ? 'sendPhoto' : 'sendMessage';
                        const payload = image_url
                            ? { chat_id: chatId, photo: image_url, caption: telegramMessage, parse_mode: 'HTML' }
                            : { chat_id: chatId, text: telegramMessage, parse_mode: 'HTML' };

                        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${endpoint}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                    }
                }
            }
        } catch (telegramError) {
            console.error("Telegram error:", telegramError);
        }

        return Response.json({ success: true, affiliate: affiliate.name, articles: createdArticles });

    } catch (error) {
        console.error("Error in automatedAffiliatePoster:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});