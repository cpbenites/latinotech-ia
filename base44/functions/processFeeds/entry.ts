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

                    // --- O MEGA PROMPT ABSOLUTO (MAXIMIZAÇÃO SERPAPI + ENGENHARIA DE VALOR) ---
                    const prompt = `Atue simultaneamente como um Engenheiro de Prompt Staff, Analista de Dados Sênior, Especialista em SEO Técnico e Editor-Chefe da LatinoTech IA.

O seu objetivo é criar um "Whitepaper Prático" ou "Guia Definitivo" épico (Mínimo absoluto de 1500 a 2000 palavras). O leitor B2B exige profundidade técnica, dados reais e aplicabilidade imediata.

FONTES DE DADOS OBRIGATÓRIAS:
- PAUTA ORIGINAL (Feed RSS): ${item.title} | ${item.contentSnippet || item.content || ''}
- DADOS DE PESQUISA EM TEMPO REAL (Google News via SerpApi): ${extraContext}

REGRAS DE OURO (MAXIMIZAÇÃO DA SERPAPI E ANTI-FLUFF):
1. CITAÇÃO NOMINAL OBRIGATÓRIA: Você DEVE mencionar as fontes presentes nos "DADOS DE PESQUISA EM TEMPO REAL". Use frases como "Segundo o [Nome da Fonte]...", "Conforme relatado hoje pelo [Nome da Fonte]...". Se não houver fontes, analise o mercado.
2. EXTRAÇÃO DE MÉTRICAS: Vasculhe a pesquisa do Google e destaque números, porcentagens, valores em dólares, datas ou versões de software. Nunca diga "muito rápido", diga "reduziu a latência em X% segundo a fonte Y".
3. PROIBIDO ADJETIVOS VAZIOS: Sem "inovador", "revolucionário" ou "divisor de águas". Mostre os fatos e deixe o leitor concluir que é inovador.
4. COERÊNCIA NATIVA: As versões 'es', 'pt' e 'en' devem usar jargões nativos de TI e negócios impecáveis. Nunca misture idiomas.

ESTRUTURA DE TÓPICOS OBRIGATÓRIA E INFLEXÍVEL:

1. H1: TÍTULO MAGNÉTICO E ORIENTADO A SEO
(Título com a palavra-chave principal + promessa de valor/resolução de problema).

2. RESUMO EXECUTIVO & DADOS-CHAVE (TL;DR)
(Mínimo de 3 parágrafos. Resuma a notícia, cruze com as informações da SerpApi e crie uma lista de "bullet points" apenas com os números e dados mais críticos extraídos da pesquisa).

3. O CONTEXTO: POR QUE ISSO IMPORTA AGORA?
(Explique o cenário de mercado ou o problema legado que forçou este lançamento ou notícia a acontecer. O que estava dando errado antes?).

4. ANÁLISE ARQUITETURAL E TÉCNICA (O "Deep Dive")
(Mínimo de 400 palavras. Dissecação total.
- Se for IA/Software/API: Topologia, fluxo de dados, latência, integração e infraestrutura necessária.
- Se for Negócios/Hardware: Modelos de receita, aquisições, cadeia de suprimentos e impacto no ecossistema).

5. TABELA DE BENCHMARKING (SEO Visual)
(Crie uma tabela Markdown robusta (4x3). Compare a novidade com seu concorrente direto ou com o padrão da indústria baseando-se em: Custo, Curva de Aprendizado, Escalabilidade e Integração).

6. LABORATÓRIO LATINOTECH: ENGENHARIA DE PROMPT E APLICAÇÃO
(Mínimo de 350 palavras. OBRIGATÓRIO gerar um "Mega Prompt" avançado e copiável (em bloco de código) para ChatGPT/Claude/Gemini, focado em aplicar o conceito da notícia no dia a dia corporativo.
- O Prompt gerado deve usar a estrutura: [Persona] + [Contexto] + [Tarefa com Restrições] + [Formato de Saída]. 
- Inclua a técnica de 'Chain of Thought' (Cadeia de Raciocínio).
- Explique tecnicamente por que este prompt economiza tempo/dinheiro).

7. IMPACTO NO OPEX/CAPEX E ESTRATÉGIA B2B
(Mínimo de 250 palavras. Análise de bolso. Custos de licenciamento, economia de tempo, substituição de ferramentas antigas e como startups vs empresas Enterprise devem reagir).

8. OS "CALCANHARES DE AQUILES" (Riscos e Limitações)
(Liste 3 defeitos severos, desafios de compliance, vazamento de dados ou limitações técnicas reais).

9. BLUEPRINT DE AÇÃO (Plano de 48 Horas)
(Forneça 3 passos táticos e técnicos exatos que um CTO, Desenvolvedor ou CEO deve executar hoje para se posicionar frente a esta novidade).

10. FAQ (As Pessoas Também Perguntam)
(Para dominar os Snippets do Google: 3 perguntas exatas de cauda longa (H3) com respostas diretas de 1 parágrafo cada).

SAÍDA OBRIGATÓRIA:
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