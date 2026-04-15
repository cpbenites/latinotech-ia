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

        const prompt = `Atue como um Jornalista de Tecnologia Sênior e Especialista em Copywriting B2B.
A sua missão é escrever um artigo de "Publicidade Nativa" disfarçado de um tutorial/guia prático de altíssimo valor sobre a plataforma "${affiliate.name}". O artigo não pode parecer um anúncio. Deve focar-se em resolver um problema real do leitor, mostrando como esta ferramenta é a solução ideal.
${affiliate.description ? `Contexto da ferramenta: ${affiliate.description}` : ''}

Gere TRES versões deste artigo: ESPAÑOL, PORTUGUÉS e INGLÉS.

REGRAS ESTRITAS DE ESTRUTURA E PERSUASÃO:
1. Título (Clickbait Educacional): Deve focar-se no resultado. Ex: "Como clonar a sua voz com IA em 2 minutos" ou "O segredo para automatizar vídeos sem aparecer".
2. Introdução (Problema & Agitação): Comece descrevendo a dor do leitor relacionada ao problema que a ferramenta resolve.
3. O Tutorial (Solução): Apresente "${affiliate.name}" como a revolução. Dê 3 exemplos práticos de como usar a ferramenta no dia a dia.
4. Inserção do Link de Afiliado: Insira a URL "${affiliate.affiliate_url}" exatamente 2 vezes no texto usando Markdown.
   - A primeira vez no meio do texto, de forma natural (ex: "Você pode [testar gratuitamente aqui](${affiliate.affiliate_url})").
   - A segunda vez no final, num bloco de Conclusão/Call-to-Action forte e direto.
5. Formatação: Use Markdown com subtítulos (##), listas e negritos para facilitar a leitura.
6. Categoria: Use "Tutoriales" ou "Software" conforme mais adequado.

Devolva EXCLUSIVAMENTE um objeto JSON válido com a seguinte estrutura:
{
  "es": { "title": "", "summary": "", "content": "", "category": "", "seo_keywords": "" },
  "pt": { "title": "", "summary": "", "content": "", "category": "", "seo_keywords": "" },
  "en": { "title": "", "summary": "", "content": "", "category": "", "seo_keywords": "" },
  "image_prompt": "Prompt em inglês, max 20 palavras, estilo hiper-realista, focado no uso de tecnologia/software relacionado ao tema."
}`;

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