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

                    // --- O MEGA PROMPT BLINDADO (CONTRA RESUMOS E TEXTOS GENÉRICOS) ---
                    const prompt = `Atue como um Engenheiro de Prompt Staff, Especialista em SEO Técnico e Editor-Chefe da LatinoTech IA.

O seu objetivo é criar um "Guia Definitivo" denso e altamente aplicável. O leitor B2B e os desenvolvedores exigem exemplos reais.

FONTES DE DADOS OBRIGATÓRIAS:
- PAUTA: ${item.title} | ${item.contentSnippet || item.content || ''}
- DADOS REAIS DA PESQUISA: ${extraContext}

REGRAS DE BLOQUEIO ABSOLUTO (PUNIÇÃO SE DESCUMPRIDAS):
1. PROIBIDO NOMES FALSOS: Na tabela e no texto, é TERMINANTEMENTE PROIBIDO usar "Concorrente A", "Empresa B" ou "Solução X". Se a notícia não citar concorrentes, USE SEU CONHECIMENTO PARA CITAR FERRAMENTAS REAIS DO MERCADO (ex: ChatGPT, AWS, Moodle, Salesforce, SAP, etc).
2. PROIBIDO TEMPLATES NO PROMPT: No 'Laboratório', NÃO forneça a estrutura do prompt (ex: não escreva "[Persona]: Educador"). Você DEVE fornecer o TEXTO EXATO, em primeira pessoa, pronto para o leitor copiar e colar na IA. (Ex: "Aja como um professor de matemática. O meu objetivo é...").
3. PROIBIDO RESUMIR: Expanda cada seção. Se os dados da pesquisa forem curtos, use seu conhecimento profundo sobre a tecnologia para explicar o 'como' e o 'porquê'.

ESTRUTURA OBRIGATÓRIA:

1. H1: TÍTULO MAGNÉTICO E ORIENTADO A SEO

2. RESUMO EXECUTIVO & DADOS-CHAVE (TL;DR)
(Extraia números reais da pesquisa ou do mercado e crie bullet points de impacto).

3. O CONTEXTO: POR QUE ISSO IMPORTA AGORA?
(Explique o cenário do mercado, a dor das empresas e por que essa tecnologia surgiu).

4. ANÁLISE ARQUITETURAL E TÉCNICA (O "Deep Dive")
(Desmonte a tecnologia. Cite linguagens de programação, tipos de rede neural, integrações de API ou arquitetura de servidores e infraestrutura).

5. TABELA DE BENCHMARKING COM FERRAMENTAS REAIS
(Crie uma tabela Markdown. Compare a novidade com 2 ferramentas/empresas REAIS e famosas do mercado. Colunas: Ferramenta | Custo Estimado | Curva de Aprendizado | Melhor Cenário de Uso).

6. LABORATÓRIO LATINOTECH: ENGENHARIA DE PROMPT (COPIAR E COLAR)
(Gere um Mega Prompt avançado em bloco de código Markdown. Ele deve ser um comando longo e perfeitamente redigido que o leitor possa simplesmente copiar e enviar para o ChatGPT/Claude agora mesmo para obter resultados profissionais sobre o tema da notícia).

7. IMPACTO NO OPEX/CAPEX E ESTRATÉGIA B2B
(Como isso reduz custos operacionais ou aumenta receita? Seja específico sobre o bolso das empresas).

8. OS "CALCANHARES DE AQUILES" (Riscos Reais)
(Seja técnico. Liste defeitos reais: latência, alucinação, vazamento de dados, custo de tokens de API, etc).

9. BLUEPRINT DE AÇÃO (Plano de 48 Horas)
(3 passos exatos que um CTO ou Diretor deve tomar agora).

10. FAQ PARA SNIPPETS DO GOOGLE
(3 perguntas de cauda longa com respostas de 1 parágrafo cada).

SAÍDA OBRIGATÓRIA:
Gere as três versões ('es', 'pt', 'en') mantendo a mesma profundidade em todas.
Devolva EXCLUSIVAMENTE o objeto JSON:
{
  "es": { "title": "...", "summary": "...", "content": "Texto MASSIVO e denso em Markdown", "category": "...", "seo_keywords": "..." },
  "pt": { "title": "...", "summary": "...", "content": "Texto MASSIVO e denso em Markdown", "category": "...", "seo_keywords": "..." },
  "en": { "title": "...", "summary": "...", "content": "Texto MASSIVO e denso em Markdown", "category": "...", "seo_keywords": "..." },
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