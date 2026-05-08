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
        const shuffledFeeds = [...activeFeeds].sort(() => Math.random() - 0.5);

        let processedCount = 0;
        const MAX_ITEMS_PER_RUN = 1;

        for (const feed of shuffledFeeds) {
            if (processedCount >= MAX_ITEMS_PER_RUN) break;
            try {
                const feedData = await parser.parseURL(feed.url);
                const items = feedData.items.slice(0, 2);

                for (const item of items) {
                    if (processedCount >= MAX_ITEMS_PER_RUN) break;

                    const existing = await base44.asServiceRole.entities.NewsArticle.filter({ original_url: item.link });
                    if (existing.length > 0) continue;

                    // ===== PASSO 1: PESQUISA RICA NA SERPAPI (Google Web filtrada por notícias) =====
                    const serpApiKey = Deno.env.get("SERP_API_KEY");
                    let extraContext = "Nenhum contexto extra encontrado.";

                    if (serpApiKey) {
                        try {
                            const searchUrl = `https://serpapi.com/search.json?engine=google&tbm=nws&q=${encodeURIComponent(item.title)}&api_key=${serpApiKey}`;
                            const serpResponse = await fetch(searchUrl);
                            const serpData = await serpResponse.json();

                            if (serpData.news_results && serpData.news_results.length > 0) {
                                const topNews = serpData.news_results.slice(0, 5);
                                extraContext = topNews.map(n =>
                                    `Fonte: ${n.source || 'Desconhecida'}\nTítulo: ${n.title}\nResumo: ${n.snippet || 'Sem resumo disponível.'}`
                                ).join("\n\n---\n\n");
                            }
                        } catch (err) {
                            console.error("Erro ao buscar contexto na SerpApi:", err);
                        }
                    }

                    // ===== PASSO 2: GERAÇÃO DO ARTIGO MESTRE EM PORTUGUÊS =====
                    const masterPrompt = `Aja como um Consultor Sênior da McKinsey (para Negócios) e um Arquiteto de Soluções Staff (para Tech). O seu objetivo é escrever um Whitepaper de 2000 palavras que seja ÚTIL para um CEO.

FONTES:
- Pauta: ${item.title} | ${item.contentSnippet || item.content || ''}
- Pesquisa Real: ${extraContext}

--- REGRAS DE OURO (LEI ABSOLUTA) ---
1. ISOLAMENTO DE CONTEXTO: Se a notícia for sobre GESTÃO, ESTRATÉGIA ou FINANÇAS, é PROIBIDO citar linguagens de programação, APIs técnicas ou infraestrutura de nuvem (AWS/Azure), a menos que a notícia fale explicitamente disso.
   - Para NEGÓCIOS, 'Análise Técnica' significa: Curva de J-Curve, EBITDA, LTV/CAC, Estratégias de Go-to-Market, Tese de Investimento e Governança.
2. PROIBIDO "CONCORRENTE A": Se não houver concorrentes na pesquisa, use o seu conhecimento para citar nomes REAIS de players do mercado (ex: para a ACE, cite Endeavor, KPMG, Distrito, etc).
3. PROMPT COPIÁVEL: No 'Laboratório', crie um prompt que resolva um problema real de gestão ou código. Use 500 palavras apenas para este prompt. Ele deve ser longo, detalhado e pronto para uso.
4. FORMATAÇÃO (LEI ABSOLUTA):
   - TABELAS À PROVA DE FALHAS: NUNCA use o formato Markdown com pipes (|) para tabelas, pois o JSON quebra as linhas. Você DEVE obrigatoriamente usar tags HTML com tags <table>, <tr>, <th> e <td> para construir a matriz comparativa.
   - O MEGA PROMPT: Deve ser um texto contínuo, em PRIMEIRA PESSOA, escrito dentro de um bloco de código Markdown (três backticks). Proibido gerar listas de dicas.
   - Use MUITO negrito no restante do texto.

--- ESTRUTURA DO ARTIGO ---

H1: [Título que prometa um segredo ou método prático]

## I. O Fato e o Impacto (TL;DR)
(Extraia números e porcentagens reais da pesquisa. Se não houver, analise o impacto financeiro no setor).

## II. Análise de Mercado e Contexto Macro
(Explique por que esse movimento está a acontecer agora. Cite tendências globais de mercado B2B).

## III. Deep Dive: A "Engenharia" por trás da Estratégia
(Aqui você deve ser denso. Se for Negócios: fale de processos, funis, teses de investimento e escala. Se for Tech: fale de arquitetura, latência e segurança).

## IV. Matriz Comparativa de Mercado
(OBRIGATÓRIO: Crie a tabela usando EXCLUSIVAMENTE HTML com as tags table, tr, th e td. Compare a novidade com 2 ferramentas reais do setor. Colunas: Empresa | Diferencial | Barreira de Entrada | Cenário Ideal).

## V. Laboratório LatinoTech: Prompt de Execução (Copiar e Colar)
(OBRIGATÓRIO: Gere o Mega Prompt dentro de um bloco de código Markdown com três backticks. O texto DEVE começar com "Atue como um especialista em...". Deve ser um comando longo, profissional, com [CONTEXTO], [TAREFA] e [FORMATO], pronto para o leitor enviar para o ChatGPT/Claude. PROIBIDO criar listas de tarefas. Apenas o prompt final).

## VI. Estratégia de Implementação B2B (CAPEX/OPEX)
(Como o leitor ganha dinheiro com isso? Como reduz custos?).

## VII. Riscos, Desafios e "The Dark Side"
(Não seja otimista. Fale de falhas de mercado, riscos de execução e problemas de segurança).

## VIII. Blueprint: O que fazer em 48 Horas
(Passos práticos).

## IX. FAQ Estratégico (Google Snippets)
(3 perguntas complexas e respostas profundas).

Devolva EXCLUSIVAMENTE o objeto JSON em Português do Brasil:
{
  "title": "...",
  "summary": "...",
  "content": "Texto MASSIVO em Markdown seguindo as 9 seções acima",
  "category": "Uma de: IA, Gadgets, Software, Startups, Gaming, Tech, Tutoriales",
  "seo_keywords": "5-8 palavras-chave SEO em PT separadas por vírgula",
  "image_prompt": "Cinematic tech editorial photography, hyper-realistic, 4k"
}
`;

                    const masterResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
                        prompt: masterPrompt,
                        response_json_schema: {
                            type: "object",
                            properties: {
                                title: { type: "string" },
                                summary: { type: "string" },
                                content: { type: "string" },
                                category: { type: "string" },
                                seo_keywords: { type: "string" },
                                image_prompt: { type: "string" }
                            },
                            required: ["title", "summary", "content", "category", "seo_keywords", "image_prompt"]
                        }
                    });

                    if (!masterResponse || !masterResponse.title || !masterResponse.content) {
                        console.error("Falha na geração do artigo mestre PT.");
                        continue;
                    }

                    // ===== PASSO 3: TRADUÇÕES NATIVAS (ES e EN) =====
                    const translationSchema = {
                        type: "object",
                        properties: {
                            title: { type: "string" },
                            summary: { type: "string" },
                            content: { type: "string" },
                            category: { type: "string" },
                            seo_keywords: { type: "string" }
                        },
                        required: ["title", "summary", "content", "category", "seo_keywords"]
                    };

                    const buildTranslationPrompt = (targetLang, langName) => `Atue como um tradutor nativo profissional especializado em jornalismo de tecnologia B2B.

Sua tarefa é TRADUZIR o seguinte artigo do Português para ${langName} de forma IMPECÁVEL e NATIVA.

REGRAS CRÍTICAS:
1. NÃO resumir. NÃO encurtar. Mantenha a mesma profundidade e densidade do original.
2. Preserve TODA a formatação Markdown (títulos ##, tabelas, blocos de código, listas, negritos).
3. Preserve os nomes próprios de empresas, produtos e tecnologias (ChatGPT, AWS, etc).
4. Adapte expressões idiomáticas para soarem naturais em ${langName}.
5. Traduza as palavras-chave SEO para ${langName} (mantendo sentido equivalente, não literal).
6. A categoria deve permanecer a mesma palavra original (uma de: IA, Gadgets, Software, Startups, Gaming, Tech, Tutoriales).

ARTIGO ORIGINAL EM PORTUGUÊS:
TÍTULO: ${masterResponse.title}
RESUMO: ${masterResponse.summary}
CATEGORIA: ${masterResponse.category}
PALAVRAS-CHAVE: ${masterResponse.seo_keywords}

CONTEÚDO:
${masterResponse.content}

Devolva EXCLUSIVAMENTE o objeto JSON traduzido para ${langName}:
{
  "title": "...",
  "summary": "...",
  "content": "Markdown completo traduzido",
  "category": "${masterResponse.category}",
  "seo_keywords": "..."
}`;

                    let esResponse = null;
                    let enResponse = null;

                    try {
                        esResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
                            prompt: buildTranslationPrompt('es', 'Espanhol (LATAM neutro)'),
                            response_json_schema: translationSchema
                        });
                    } catch (e) {
                        console.error("Falha na tradução ES:", e);
                    }

                    try {
                        enResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
                            prompt: buildTranslationPrompt('en', 'Inglês (US)'),
                            response_json_schema: translationSchema
                        });
                    } catch (e) {
                        console.error("Falha na tradução EN:", e);
                    }

                    // ===== PASSO 4a: GERAR IMAGEM =====
                    let image_url = "";
                    try {
                        const imgResponse = await base44.asServiceRole.integrations.Core.GenerateImage({
                            prompt: masterResponse.image_prompt + ", highly detailed, tech news editorial photography, clean white background, modern tech style, 1080p, minimalist"
                        });
                        image_url = imgResponse.url;
                    } catch (e) {
                        console.error("Image generation failed:", e);
                    }

                    // ===== PASSO 4b: SALVAR OS 3 ARTIGOS =====
                    const allLangs = {
                        pt: masterResponse,
                        es: esResponse,
                        en: enResponse
                    };

                    const createdArticles = {};

                    for (const lang of ['pt', 'es', 'en']) {
                        const langData = allLangs[lang];
                        if (!langData || !langData.title || !langData.content) continue;

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

                    // ===== PASSO 4c: NOTIFICAR TELEGRAM =====
                    try {
                        const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
                        const chatIds = {
                            es: Deno.env.get("TELEGRAM_CHAT_ID") || "@latinotech",
                            pt: "@latinotechbr",
                            en: "@latinotechen"
                        };

                        if (TELEGRAM_BOT_TOKEN) {
                            for (const lang of ['pt', 'es', 'en']) {
                                const article = createdArticles[lang];
                                const langData = allLangs[lang];
                                const chatId = chatIds[lang];

                                if (chatId && article && langData) {
                                    const shortSummary = langData.summary.length > 150 ? langData.summary.substring(0, 147) + "..." : langData.summary;

                                    let urlPath = `/noticia/${article.slug}`;
                                    if (lang === 'pt') urlPath = `/br/noticia/${article.slug}`;
                                    if (lang === 'en') urlPath = `/en/news/${article.slug}`;

                                    const cta = lang === 'pt' ? 'Leia a notícia completa aqui:' : lang === 'en' ? 'Read the full story here:' : 'Lee la noticia completa aquí:';
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