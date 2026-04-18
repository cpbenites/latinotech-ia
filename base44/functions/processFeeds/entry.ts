import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Parser from 'npm:rss-parser';

const parser = new Parser();

function generateSlug(text: string) {
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
                    
                    // --- O PROMPT DEVE FICAR AQUI DENTRO, ONDE O 'item' EXISTE ---
                    const prompt = `Atue como um Jornalista Sênior de Tecnologia e Analista Técnico da LatinoTech IA.
Acabamos de receber a seguinte pauta bruta de um feed RSS:
TÍTULO: ${item.title}
CONTEÚDO/RESUMO: ${item.contentSnippet || item.content || ''}

A sua missão é transformar este resumo raso numa MATÉRIA JORNALÍSTICA PROFUNDA, TÉCNICA E ABRANGENTE (Mínimo de 600 a 800 palavras). O público é formado por desenvolvedores, donos de agências e entusiastas de IA. 

Gere TRES versões do artigo: ESPAÑOL, PORTUGUÉS e INGLÉS.

REGRAS ESTRITAS DE ESCRITA E EXPANSÃO (CRÍTICO):
1. PROIBIDO usar clichês introdutórios (Ex: "No mundo digital de hoje", "Em constante evolução"). Vá direto à notícia com um "Gancho" jornalístico forte.
2. Profundidade Técnica: Não apenas repita o que aconteceu. Explique COMO a tecnologia funciona. Se a notícia for sobre uma API, ferramenta ou comando, explique a lógica por trás disso. Use o seu conhecimento para expandir o contexto técnico.
3. Estrutura Obrigatória em Markdown:
   - Título Chamativo (SEO-friendly).
   - Introdução Direta: O que aconteceu e qual é o impacto imediato.
   - ## Deep Dive: O detalhe técnico da inovação/ferramenta.
   - ## Impacto no Mercado: Como isso afeta Startups, Empresas B2B ou Criadores.
   - ## Vantagens e Desafios: Use listas (*) para pontos positivos e negativos.
   - > Use blocos de citação para destacar conceitos fundamentais ou frases de impacto.
   - ## Veredicto: Uma reflexão final sobre os próximos passos da indústria.
4. Formatação: O texto deve ser denso, com termos técnicos em **negrito**.

Devolva EXCLUSIVAMENTE um objeto JSON válido:
{
  "es": { "title": "", "summary": "Resumo forte e direto de 2 linhas", "content": "Texto longo, técnico e rico em Markdown", "category": "", "seo_keywords": "" },
  "pt": { "title": "", "summary": "Resumo forte e direto de 2 linhas", "content": "Texto longo, técnico e rico em Markdown", "category": "", "seo_keywords": "" },
  "en": { "title": "", "summary": "Resumo forte e direto de 2 linhas", "content": "Texto longo, técnico e rico em Markdown", "category": "", "seo_keywords": "" },
  "image_prompt": "Prompt de imagem descritivo em inglês, max 20 palavras, focado no tema da tecnologia da notícia."
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
                    
                    const createdArticles: Record<string, any> = {};
                    
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
                        const chatIds: Record<string, string> = {
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
        return Response.json({ error: (error as Error).message }, { status: 500 });
    }
});