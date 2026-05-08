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

                    // ===== PASSO 1: PESQUISA RICA NA EXA.AI (Full Text) =====
                    const exaApiKey = Deno.env.get("EXA_API_KEY");
                    let extraContext = "";

                    if (exaApiKey) {
                        try {
                            const exaResponse = await fetch("https://api.exa.ai/search", {
                                method: "POST",
                                headers: {
                                    "x-api-key": exaApiKey,
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    query: item.title,
                                    useAutoprompt: true,
                                    numResults: 2,
                                    contents: { text: true }
                                })
                            });
                            const exaData = await exaResponse.json();

                            if (exaData.results && exaData.results.length > 0) {
                                extraContext = exaData.results.map(r =>
                                    `Fonte: ${r.title}\nConteúdo Completo: ${r.text}`
                                ).join("\n\n---\n\n");
                            }
                        } catch (err) {
                            console.error("Erro ao buscar contexto na Exa:", err);
                        }
                    }

                    // ===== PASSO 2: GERAÇÃO DO ARTIGO MESTRE EM PORTUGUÊS =====
                    const masterPrompt = `Aja como um Editor-Chefe da Wired e um Especialista em Engenharia de Prompt. Você deve escrever um artigo técnico-jornalístico PROFUNDO de no MÍNIMO 2.000 palavras em Português do Brasil.

FONTES DISPONÍVEIS (LEITURA OBRIGATÓRIA):
- Título RSS: ${item.title}
- Conteúdo Exa.ai (Texto Completo das Fontes): ${extraContext}

REGRAS DE OURO CONTRA A SUPERFICIALIDADE:
- PROIBIDO RESUMIR: Se o assunto for complexo, explique cada detalhe técnico. Cada subtópico (H2) deve ter pelo menos 5 parágrafos longos.
- CITE DADOS: Use os números, nomes de executivos e estatísticas encontrados no texto da Exa.ai.
- O MEGA PROMPT: Na seção 'Laboratório', você deve criar um Prompt de no mínimo 400 palavras. Ele deve ser um comando complexo, com variáveis, persona e lógica de raciocínio, pronto para copiar. PROIBIDO criar listas de dicas.

ESTRUTURA EXIGIDA:

# [H1: Título Provocativo e Técnico]

## I. O Fato e a Análise de Impacto (Mínimo 300 palavras)
(Disseque a notícia. O que aconteceu, quem são os envolvidos e por que isso muda o jogo hoje?)

## II. Deep Dive: A Engenharia e o Modelo de Negócio (Mínimo 500 palavras)
(Use o texto da Exa.ai para explicar COMO a tecnologia funciona ou como a estratégia financeira foi montada. Seja extremamente detalhista).

## III. Matriz Comparativa (Tabela HTML)
(Crie uma tabela <table> com ferramentas/empresas REAIS. Compare diferenciais técnicos e barreiras de entrada).

## IV. Laboratório LatinoTech: O Mega Prompt Definitivo
(Escreva um bloco de código Markdown \`\`\` contendo um prompt GIGANTE e PROFISSIONAL que o leitor pode copiar agora. O prompt deve instruir a IA a resolver o problema exato citado na notícia).

## V. Estratégia B2B e Retorno (OPEX/CAPEX) (Mínimo 400 palavras)
(Análise para CEOs: quanto custa, quanto economiza e como implementar na empresa).

## VI. Riscos e Limitações (The Dark Side)
(O que pode dar errado? Fale de segurança, custos de API ou falhas de mercado).

## VII. Plano de Ação 48h e FAQ
(Passos táticos e 3 perguntas de alto nível para SEO).

Responda APENAS o JSON:
{
  "title": "...",
  "summary": "Resumo forte de 2 linhas",
  "content": "Texto MASSIVO e completo em Markdown — mínimo 2000 palavras",
  "category": "Uma de: IA, Gadgets, Software, Startups, Gaming, Tech, Tutoriales",
  "seo_keywords": "5-8 palavras-chave SEO em PT separadas por vírgula",
  "image_prompt": "Cinematic tech editorial photography, hyper-realistic, 4k"
}
`;

                    const masterResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
                        prompt: masterPrompt,
                        model: "claude_sonnet_4_6",
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