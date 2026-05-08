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

                    // --- O MEGA PROMPT "GOD-TIER" (UTILIDADE PRÁTICA + MASTER SEO) ---
                    const prompt = `Atue como um Engenheiro de Prompt Sênior, Arquiteto de Soluções, Estrategista B2B e Especialista em SEO Técnico para a LatinoTech IA. 
Você recebeu uma pauta bruta de um feed RSS e os resultados de pesquisa do Google News.

PAUTA RSS:
TÍTULO: ${item.title}
RESUMO: ${item.contentSnippet || item.content || ''}

CONTEXTO DO GOOGLE NEWS (Fatos reais):
${extraContext}

Sua missão é criar um artigo "How-To" (Como Fazer) épico, altamente prático e otimizado para o Google (Mínimo de 1000 a 1200 palavras). O leitor quer saber COMO APLICAR essa novidade no seu negócio ou código.

ESTRUTURA OBRIGATÓRIA E ACIONÁVEL (Siga a ordem):

1. DIRETO AO PONTO (O Gancho): Comece explicando o que é a novidade, o problema exato que ela resolve e o impacto no mercado (sem frases de efeito genéricas).
2. COMO FUNCIONA (A MECÂNICA): Explique a arquitetura, as integrações ou a lógica por trás da ferramenta/notícia com base nos fatos da pesquisa.
3. 📊 TABELA DE COMPARAÇÃO / ROI (Obrigatório para SEO): Crie uma tabela em Markdown. Se for software/hardware, compare a novidade com a versão anterior ou com o principal concorrente. Se for uma notícia de mercado, faça uma tabela de "Custo vs. Benefício" ou "Antes vs. Depois".
4. 🛠️ CASOS DE USO PRÁTICOS: Descreva 2 a 3 cenários reais de como empresas, agências ou desenvolvedores podem usar essa tecnologia no dia a dia para reduzir OPEX ou escalar vendas.
5. 🚀 MATERIAL PRONTO PARA USO (Obrigatório):
   - SE for sobre IAs generativas: Crie 2 exemplos de "Mega Prompts" avançados (em blocos de código) prontos para copiar e colar.
   - SE for sobre programação/APIs: Escreva um bloco de código realista (JSON, Python, JS) mostrando como integrar a novidade.
   - SE for puramente sobre hardware/mercado: Dê um checklist prático de implementação.
6. PLANO DE AÇÃO EM 3 PASSOS: Diga ao leitor 3 passos exatos que ele deve fazer hoje para aproveitar esta tecnologia.
7. ❓ FAQ (As Pessoas Também Perguntam): Crie 3 perguntas curtas e respostas diretas sobre o tema para ranquear nos Snippets do Google.

REGRAS DE OURO (ANTI-FLUFF & SEO):
- Use termos de LSI (Latent Semantic Indexing) naturalmente pelo texto.
- Use listas, bullet points e muito **negrito** em conceitos-chave para leitura escaneável.
- TRADUÇÃO NATIVA E IMPECÁVEL: As versões ('es', 'pt', 'en') não devem parecer traduzidas, mas sim escritas por especialistas locais. Cuidado com falsos cognatos na tecnologia.

Devolva EXCLUSIVAMENTE um objeto JSON válido:
{
  "es": { "title": "Título magnético focado em SEO e Benefício", "summary": "Resumo de 2 linhas focado em CTR", "content": "Texto MASSIVO, estruturado, com tabela e prático em Markdown", "category": "", "seo_keywords": "keyword1, keyword2, long tail keyword 3" },
  "pt": { "title": "Título magnético focado em SEO e Benefício", "summary": "Resumo de 2 linhas focado em CTR", "content": "Texto MASSIVO, estruturado, com tabela e prático em Markdown", "category": "", "seo_keywords": "keyword1, keyword2, long tail keyword 3" },
  "en": { "title": "Título magnético focado em SEO e Benefício", "summary": "Resumo de 2 linhas focado em CTR", "content": "Texto MASSIVO, estruturado, com tabela e prático em Markdown", "category": "", "seo_keywords": "keyword1, keyword2, long tail keyword 3" },
  "image_prompt": "Cinematic tech editorial photography, hyper-realistic, 4k, professional lighting, clean web aesthetic"
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