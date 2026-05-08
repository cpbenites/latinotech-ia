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
                    const masterPrompt = `Atue como um Analista Sênior de Mercado, Engenheiro de Prompt e Editor-Chefe da LatinoTech IA.

O seu objetivo é criar um "Guia Definitivo" ou "Whitepaper" de no MÍNIMO 1500 palavras em Português do Brasil.

FONTES DE DADOS OBRIGATÓRIAS:

PAUTA ORIGINAL: ${item.title} | ${item.contentSnippet || item.content || ''}

DADOS REAIS DA PESQUISA (Google News): ${extraContext}

REGRA CONDICIONAL ABSOLUTA (O SEU CÉREBRO):
Leia a notícia e defina de que mundo ela é:
CENÁRIO A (NEGÓCIOS / STARTUPS / VC / FINANÇAS): É PROIBIDO inventar stacks de tecnologia (Python, AWS, Redes Neurais). A sua análise deve ser 100% focada no Modelo de Negócios, Valuation, Tamanho do Mercado (TAM/SAM/SOM), Estratégia de Aquisição (CAC/LTV) e tendências de consumo.
CENÁRIO B (SOFTWARE / IA / HARDWARE / APIS): Foco total em infraestrutura, latência, integrações, linguagens de programação e arquitetura de dados.

REGRAS DE FORMATAÇÃO E VOLUME (LEI):

EXPANSÃO OBRIGATÓRIA: Cada subtópico (H2) abaixo DEVE conter no mínimo de 3 a 4 parágrafos longos e detalhados. NUNCA resuma.

TABELAS: Você DEVE usar quebras de linha reais (\\n) nas tabelas Markdown para que elas renderizem corretamente.

ESTRUTURA DO ARTIGO (Siga a ordem e os limites de expansão):

H1: TÍTULO MAGNÉTICO E ORIENTADO A SEO

RESUMO EXECUTIVO & DADOS-CHAVE (TL;DR)
(Mínimo de 3 parágrafos. Resuma a notícia, cruze com a pesquisa e faça uma lista de métricas/números extraídos dos dados reais).

O CONTEXTO: O PROBLEMA QUE EXIGIU ESTA SOLUÇÃO
(Mínimo de 3 parágrafos. Explique o cenário atual. Por que essa empresa/tecnologia/fundo fez esse movimento agora?).

ANÁLISE PROFUNDA (O "DEEP DIVE" ADAPTÁVEL)
(Mínimo de 4 parágrafos. Aplique a REGRA CONDICIONAL aqui. Se for negócios: dissecque a estratégia, o mercado-alvo e o impacto financeiro. Se for tech: dissecque a arquitetura, integrações e gargalos técnicos).

TABELA DE BENCHMARKING COM FERRAMENTAS/EMPRESAS REAIS
(Compare a novidade com 2 concorrentes reais do mercado. Colunas: Empresa/Ferramenta | Diferencial Principal | Ponto Fraco | Melhor Cenário. Garanta a formatação Markdown perfeita com quebras de linha).

LABORATÓRIO LATINOTECH: MEGA PROMPT COPIÁVEL
(Mínimo de 3 parágrafos. Crie um "Mega Prompt" PROFISSIONAL E EXTENSO em bloco de código para o ChatGPT/Claude, ajudando o leitor a aplicar a estratégia ou tecnologia da notícia no seu próprio negócio. O prompt DEVE ter tags [CONTEXTO], [TAREFA], [RESTRIÇÕES] e [FORMATO DE SAÍDA]. Depois, explique por que este prompt tem alto valor).

IMPACTO ESTRATÉGICO B2B (OPEX E RECEITA)
(Mínimo de 3 parágrafos. Como startups e grandes empresas podem lucrar com isso ou economizar dinheiro?).

OS "CALCANHARES DE AQUILES" (Riscos Reais)
(Mínimo de 2 parágrafos. Liste defeitos ou riscos: bolha de mercado, falha de segurança, custos ocultos).

BLUEPRINT DE AÇÃO (Plano de 48 Horas)
(3 passos táticos exatos e práticos que o leitor deve tomar agora).

FAQ (As Pessoas Também Perguntam)
(3 perguntas estratégicas com respostas completas).

Devolva EXCLUSIVAMENTE o objeto JSON:
{
"title": "...",
"summary": "...",
"content": "Texto GIGANTE em Markdown, seguindo as regras de parágrafos",
"category": "...",
"seo_keywords": "...",
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