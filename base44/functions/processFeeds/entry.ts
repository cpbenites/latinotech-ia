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
        
        // 1. Cria uma cópia segura da lista e embaralha
        const shuffledFeeds = [...activeFeeds].sort(() => Math.random() - 0.5);
        
        let processedCount = 0;
        
        // 2. Reduzimos para 1 item por rodada para evitar o Timeout
        const MAX_ITEMS_PER_RUN = 1; 
        
        // 3. APENAS UM LOOP usando a lista embaralhada
        for (const feed of shuffledFeeds) {
            if (processedCount >= MAX_ITEMS_PER_RUN) break;
            try {
                const feedData = await parser.parseURL(feed.url);
                const items = feedData.items.slice(0, 2);
                
                for (const item of items) {
                    if (processedCount >= MAX_ITEMS_PER_RUN) break;
                    
                    const existing = await base44.asServiceRole.entities.NewsArticle.filter({ original_url: item.link });
                    if (existing.length > 0) continue;
                    
                    // --- INÍCIO DA PESQUISA NO GOOGLE NEWS (SERPAPI) ---
                    const serpApiKey = Deno.env.get("SERP_API_KEY");
                    let extraContext = "Nenhum contexto extra encontrado.";

                    if (serpApiKey) {
                        try {
                            const searchUrl = `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(item.title)}&api_key=${serpApiKey}`;
                            const serpResponse = await fetch(searchUrl);
                            const serpData = await serpResponse.json();

                            if (serpData.news_results && serpData.news_results.length > 0) {
                                const topNews = serpData.news_results.slice(0, 3);
                                extraContext = topNews.map(n => 
                                    `Fonte: ${n.source?.name || 'Desconhecida'}\nTítulo: ${n.title}\nResumo do Google: ${n.snippet}`
                                ).join("\n\n---\n\n");
                            }
                        } catch (err) {
                            console.error("Erro ao buscar contexto na SerpApi:", err);
                        }
                    }
                    // --- FIM DA PESQUISA ---

                    // --- O SEU NOVO MEGA PROMPT ADAPTÁVEL ---
                    const prompt = `Atue como um Jornalista Investigativo de Tecnologia e Analista Sênior de Mercado para a LatinoTech IA. 
Você recebeu uma pauta bruta de um feed RSS e os resultados de pesquisa do Google News sobre o assunto.

PAUTA RSS (Sua base):
TÍTULO: ${item.title}
RESUMO: ${item.contentSnippet || item.content || ''}

INFORMAÇÕES ADICIONAIS DO GOOGLE NEWS (Use isto para aprofundar a matéria e trazer fatos reais):
${extraContext}

Sua missão é criar uma matéria jornalística premium e aprofundada (Mínimo de 800 a 1000 palavras). O texto deve ser digno de jornais como TechCrunch ou Wired.

REGRAS DE ESTRUTURA E ADAPTAÇÃO (CRÍTICO):
1. ADAPTAÇÃO AO TEMA: 
   - SE a notícia for puramente sobre negócios, leis, IA, gadgets ou mercado corporativo: Foque em análise de mercado, impacto estratégico, OPEX/CAPEX, cibersegurança e tendências. NÃO invente blocos de código ou stacks tecnológicas que não existem.
   - SE a notícia for estritamente sobre uma nova API, linguagem de programação, framework ou ferramenta de desenvolvedor: Aí sim, inclua uma seção "Deep Dive Técnico" com um exemplo de bloco de código Markdown realista.
2. TÍTULOS E SUBTÍTULOS: NUNCA use as minhas instruções como título (ex: não escreva "Introdução" ou "O Problema Tradicional"). Crie subtítulos jornalísticos, criativos e chamativos (ex: "A Nova Era da Cibersegurança nos Tribunais").
3. FLUXO JORNALÍSTICO:
   - Comece com um gancho forte usando os fatos da pesquisa do Google.
   - Explique o contexto e o problema que levou a esta notícia.
   - Analise o impacto no mercado B2B, Startups e no mundo corporativo.
   - Destaque as vantagens e os grandes desafios (seja crítico e honesto).
4. > CITAÇÃO: Crie uma frase de impacto formatada como citação no Markdown (usando o símbolo >).
5. VEREDICTO: Termine com "O Veredicto LatinoTech" indicando o que as empresas devem esperar ou fazer a seguir.

TRADUÇÃO: Gere versões completas e fluídas em Espanhol ('es'), Português ('pt') e Inglês ('en').

Devolva EXCLUSIVAMENTE um objeto JSON válido:
{
  "es": { "title": "", "summary": "Resumo forte de 2 linhas", "content": "Texto jornalístico MASSIVO e fluido em Markdown", "category": "", "seo_keywords": "" },
  "pt": { "title": "", "summary": "Resumo forte de 2 linhas", "content": "Texto jornalístico MASSIVO e fluido em Markdown", "category": "", "seo_keywords": "" },
  "en": { "title": "", "summary": "Resumo forte de 2 linhas", "content": "Texto jornalístico MASSIVO e fluido em Markdown", "category": "", "seo_keywords": "" },
  "image_prompt": "Cinematic tech editorial photography, hyper-realistic, 8k."
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
        return Response.json({ error: error.message || String(error) }, { status: 500 });
    }
});