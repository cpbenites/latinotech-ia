import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Parser from 'npm:rss-parser';

const parser = new Parser();

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
        
        const feeds = await base44.asServiceRole.entities.RssFeed.list();
        const activeFeeds = feeds.filter(f => f.is_active);
        
        let processedCount = 0;
        const MAX_ITEMS_PER_RUN = 2; 
        
        for (const feed of activeFeeds) {
            if (processedCount >= MAX_ITEMS_PER_RUN) break;
            try {
                const feedData = await parser.parseURL(feed.url);
                const items = feedData.items.slice(0, 2);
                
                for (const item of items) {
                    if (processedCount >= MAX_ITEMS_PER_RUN) break;
                    const existing = await base44.asServiceRole.entities.NewsArticle.filter({ original_url: item.link });
                    if (existing.length > 0) continue;
                    
                    const prompt = `Atue como um Jornalista Investigativo Sênior da LatinoTech IA.
Acabamos de receber a seguinte notícia bruta:
TÍTULO: ${item.title}
CONTEÚDO/RESUMO: ${item.contentSnippet || item.content || ''}

A sua missão é expandir esta informação e criar uma matéria jornalística completa, profunda e de alta qualidade (mínimo de 500 palavras).

Gere TRES versões do artigo: ESPAÑOL, PORTUGUÉS e INGLÉS.

REGRAS DE ESCRITA:
1. Profundidade: Não se limite a repetir a notícia. Expanda o contexto. Explique o "Porquê" e o "Impacto" desta notícia no mercado de tecnologia, IA ou startups.
2. Estrutura:
   - Título Chamativo e SEO-friendly.
   - Introdução forte (o que aconteceu).
   - O Contexto (porque é que isto importa agora).
   - O Futuro (quais os próximos passos ou consequências disto).
3. Formatação: O texto deve ser rico em formatação Markdown. Use vários subtítulos (##), listas (se aplicável) e coloque os termos técnicos em negrito.
4. Categoria: Escolha a mais adequada entre: IA, Startups, Gadgets, Software, Gaming.

Devolva EXCLUSIVAMENTE um objeto JSON válido:
{
  "es": { "title": "", "summary": "Resumo de 2 linhas", "content": "Texto longo em Markdown", "category": "", "seo_keywords": "" },
  "pt": { "title": "", "summary": "Resumo de 2 linhas", "content": "Texto longo em Markdown", "category": "", "seo_keywords": "" },
  "en": { "title": "", "summary": "Resumo de 2 linhas", "content": "Texto longo em Markdown", "category": "", "seo_keywords": "" },
  "image_prompt": "Prompt de imagem descritivo em inglês, max 20 palavras, focado no tema da notícia."
}`;
                    
                    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
                        prompt: prompt,
                        response_json_schema: {
                            type: "object",
                            properties: {
                                es: { type: "object", properties: { title: { type: "string" }, summary: { type: "string" }, content: { type: "string" }, category: { type: "string" }, seo_keywords: { type: "string" } } },
                                pt: { type: "object", properties: { title: { type: "string" }, summary: { type: "string" }, content: { type: "string" }, category: { type: "string" }, seo_keywords: { type: "string" } } },
                                en: { type: "object", properties: { title: { type: "string" }, summary: { type: "string" }, content: { type: "string" }, category: { type: "string" }, seo_keywords: { type: "string" } } },
                                image_prompt: { type: "string" }
                            }
                        }
                    });
                    
                    let image_url = "";
                    try {
                        const imgResponse = await base44.asServiceRole.integrations.Core.GenerateImage({
                            prompt: llmResponse.image_prompt + ", highly detailed, tech news editorial photography, clean white background, modern tech style, 1080p, highly compressed web resolution, minimalist"
                        });
                        image_url = imgResponse.url;
                    } catch (e) {
                        console.error("Image generation failed:", e);
                    }
                    
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
                            original_url: item.link,
                            image_url: image_url,
                            category: langData.category || feed.category,
                            status: "pending",
                            seo_keywords: langData.seo_keywords,
                            source_name: feed.name,
                            language: lang,
                            published_date: new Date().toISOString()
                        });
                        
                        createdArticles[lang] = createdArticle;
                    }

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
                                    const shortSummary = langData.summary.length > 150 ? langData.summary.substring(0, 147) + "..." : langData.summary;
                                    
                                    // URL Dinâmica baseada no Idioma para o SEO perfeito
                                    let urlPath = `/noticia/${article.slug}`;
                                    if (lang === 'pt') urlPath = `/br/noticia/${article.slug}`;
                                    if (lang === 'en') urlPath = `/en/news/${article.slug}`;
                                    
                                    const telegramMessage = `<b>${langData.title}</b>\n\n${shortSummary}\n\n🚀 ${lang === 'pt' ? 'Leia a notícia completa aqui:' : lang === 'en' ? 'Read the full story here:' : 'Lee la noticia completa aquí:'}\nhttps://latinotechia.com${urlPath}`;
                                    
                                    if (image_url) {
                                        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                chat_id: chatId,
                                                photo: image_url,
                                                caption: telegramMessage,
                                                parse_mode: 'HTML'
                                            })
                                        });
                                    } else {
                                        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                chat_id: chatId,
                                                text: telegramMessage,
                                                parse_mode: 'HTML'
                                            })
                                        });
                                    }
                                }
                            }
                        }
                    } catch (telegramError) {
                        console.error("Error al enviar mensaje a Telegram:", telegramError);
                    }

                    processedCount++;
                }
            } catch (e) {
                console.error(`Error processing feed ${feed.url}:`, e);
            }
        }
        
        return Response.json({ success: true, processed: processedCount });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});