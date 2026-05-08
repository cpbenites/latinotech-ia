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

                    // --- O MEGA PROMPT DEFINITIVO (NÍVEL WHITEPAPER TÉCNICO) ---
                    const prompt = `Atue simultaneamente como um Engenheiro de Software Staff, Analista de Dados Sênior, Especialista em SEO e Editor-Chefe da LatinoTech IA.

O seu objetivo não é relatar uma notícia, mas sim dissecar uma tecnologia, framework ou evento de mercado com profundidade cirúrgica, criando um "Guia Definitivo" ou "Whitepaper Prático" de no MÍNIMO 1500 palavras.

FONTES DE DADOS (Considere como fatos absolutos):
- PAUTA ORIGINAL (Feed RSS): ${item.title} | ${item.contentSnippet || item.content || ''}
- DADOS DE PESQUISA EM TEMPO REAL (Google News via SerpApi): ${extraContext}

REGRAS ESTILÍSTICAS E PROIBIÇÕES (ANTI-FLUFF):
- PROIBIDO usar adjetivos vazios (ex: "inovador", "revolucionário", "divisor de águas", "game changer"). Substitua por métricas ou fatos concretos extraídos da pesquisa.
- PROIBIDO fazer parágrafos de transição genéricos. Cada frase deve entregar informação nova.
- OBRIGATÓRIO usar o formato Markdown avançado: listas encadeadas, negrito para termos técnicos, blocos de citação (>) para insights de mercado, e tabelas.
- OBRIGATÓRIO manter a coerência de idiomas nativos. NUNCA misture espanhol com português. Use os jargões corretos de TI para cada idioma (ex: 'deployment', 'framework', 'OPEX', 'ROI' são aceitos universalmente).

ESTRUTURA DE TÓPICOS OBRIGATÓRIA (Siga exatamente esta arquitetura e expansão):

1. H1: TÍTULO MAGNÉTICO E ORIENTADO A SEO
(Crie um título que inclua a palavra-chave principal e uma promessa clara de valor técnico ou de negócios).

2. RESUMO EXECUTIVO (TL;DR)
(Mínimo de 3 parágrafos curtos e densos. Resuma o problema, a solução apresentada na notícia e o impacto imediato. Vá direto aos fatos e números encontrados no Google News).

3. ANÁLISE ARQUITETURAL E TÉCNICA (O "Deep Dive")
(Mínimo de 400 palavras. Desmonte a tecnologia.
- Se for software/IA/API: Explique a topologia provável, como os dados fluem, latência esperada, linguagens suportadas e potenciais gargalos de infraestrutura.
- Se for negócios/mercado: Analise os modelos de receita, aquisições, fusões, impacto nas ações e barreiras de entrada).

4. TABELA DE BENCHMARKING OU MATRIZ DE DECISÃO
(OBRIGATÓRIO: Crie uma tabela Markdown complexa com pelo menos 4 linhas e 3 colunas. Compare a tecnologia/notícia atual com a alternativa legada ou principal concorrente com base em: Custos, Curva de Aprendizado, Escalabilidade, e Integração).

5. LABORATÓRIO LATINOTECH: COMO IMPLEMENTAR NA PRÁTICA
(Mínimo de 300 palavras. O leitor precisa sair daqui com um material "copiar e colar".
- Exigência: Crie um bloco de código (JSON, Python, JavaScript, Bash) ou um Mega Prompt de IA pronto para uso. O código ou prompt DEVE resolver um problema empresarial real, ser comentado passo a passo e ser realista).

6. IMPACTO NO OPEX/CAPEX E ESTRATÉGIA B2B
(Mínimo de 250 palavras. Responda: Como isso afeta o bolso das empresas? Analise os custos de licenciamento, economia de tempo, redução de equipe ou necessidade de treinamento. Cite como startups versus empresas Enterprise devem lidar com isso).

7. OS "CALCANHARES DE AQUILES" (Riscos e Limitações Reais)
(Seja um crítico severo. Liste 3 defeitos, desafios de segurança (compliance, vazamento de dados), ou limitações técnicas da tecnologia abordada. Nada é perfeito; exponha a realidade).

8. BLUEPRINT DE AÇÃO (Os 3 Passos Imediatos)
(Substitua a conclusão tradicional. Forneça 3 passos táticos, técnicos ou de gestão que um CTO ou CEO deve executar nas próximas 48 horas para se posicionar frente a esta novidade).

9. FAQ PARA SNIPPETS DO GOOGLE (SEO Master)
(Crie 3 perguntas comuns (H3) baseadas na intenção de busca do usuário sobre o tema e responda a cada uma em exatamente um parágrafo direto e objetivo).

SAÍDA OBRIGATÓRIA:
Gere as versões completas para 'es', 'pt', e 'en'.
Devolva EXCLUSIVAMENTE o objeto JSON com esta estrutura exata:
{
  "es": { "title": "...", "summary": "...", "content": "Texto MASSIVO de 1500+ palavras em Markdown", "category": "...", "seo_keywords": "..." },
  "pt": { "title": "...", "summary": "...", "content": "Texto MASSIVO de 1500+ palavras em Markdown", "category": "...", "seo_keywords": "..." },
  "en": { "title": "...", "summary": "...", "content": "Texto MASSIVO de 1500+ palavras em Markdown", "category": "...", "seo_keywords": "..." },
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