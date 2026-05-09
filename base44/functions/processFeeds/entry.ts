import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
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
    const base44 = createClientFromRequest(req);
    const logs = [];

    try {
        // STEP 1: Feeds RSS
        logs.push("STEP 1: Buscando feeds ativos...");
        const feeds = await base44.asServiceRole.entities.RssFeed.list();
        const activeFeeds = feeds.filter(f => f.is_active);
        logs.push(`STEP 1 OK: ${activeFeeds.length} feeds ativos.`);

        if (activeFeeds.length === 0) {
            return Response.json({ success: false, message: "Nenhum feed ativo.", logs });
        }

        const shuffledFeeds = [...activeFeeds].sort(() => Math.random() - 0.5);

        // STEP 2: Encontrar 1 item novo
        let chosenFeed = null;
        let chosenItem = null;

        logs.push("STEP 2: Procurando item novo não duplicado...");
        for (const feed of shuffledFeeds) {
            try {
                const feedData = await parser.parseURL(feed.url);
                for (const item of feedData.items.slice(0, 5)) {
                    if (!item.link) continue;
                    const existing = await base44.asServiceRole.entities.NewsArticle.filter({ original_url: item.link });
                    if (existing.length === 0) {
                        chosenFeed = feed;
                        chosenItem = item;
                        break;
                    }
                }
                if (chosenItem) break;
            } catch (e) {
                logs.push(`STEP 2 WARN: Erro ao ler ${feed.url}: ${e.message}`);
            }
        }

        if (!chosenItem) {
            logs.push("STEP 2: Nenhum item novo encontrado em todos os feeds.");
            return Response.json({ success: true, processed: 0, message: "Sem novos itens.", logs });
        }
        logs.push(`STEP 2 OK: Item escolhido: "${chosenItem.title}" do feed "${chosenFeed.name}"`);

        // STEP 3: RAG Híbrido — Jina Reader + Exa.ai em paralelo
        let extraContext = "";
        logs.push("STEP 3: Iniciando extração híbrida (Jina + Exa) em paralelo...");

        try {
            const fetchPromises = [];

            // 1. Jina Reader — conteúdo completo da fonte original (com API Key)
            if (chosenItem.link) {
                const jinaApiKey = Deno.env.get("JINA_API_KEY");
                const jinaHeaders = jinaApiKey ? { "Authorization": `Bearer ${jinaApiKey}` } : {};

                fetchPromises.push(
                    fetch(`https://r.jina.ai/${chosenItem.link}`, { headers: jinaHeaders })
                        .then(res => res.ok ? res.text() : "")
                        .then(text => text ? `\n--- CONTEÚDO OFICIAL (JINA) ---\n${text}` : "")
                        .catch(() => "")
                );
            }

            // 2. Exa.ai — contexto de mercado
            const exaApiKey = Deno.env.get("EXA_API_KEY");
            if (exaApiKey) {
                fetchPromises.push(
                    fetch("https://api.exa.ai/search", {
                        method: "POST",
                        headers: { "x-api-key": exaApiKey, "Content-Type": "application/json" },
                        body: JSON.stringify({
                            query: chosenItem.title,
                            useAutoprompt: true,
                            numResults: 2,
                            contents: { text: true }
                        })
                    })
                    .then(res => res.ok ? res.json() : {})
                    .then(data => {
                        if (data.results && data.results.length > 0) {
                            const exaText = data.results.map(r => `Fonte Extra: ${r.title}\n${r.text}`).join("\n\n");
                            return `\n\n--- CONTEXTO DE MERCADO (EXA) ---\n${exaText}`;
                        }
                        return "";
                    })
                    .catch(() => "")
                );
            }

            const results = await Promise.all(fetchPromises);
            extraContext = results.join("");
            logs.push(`STEP 3 OK: ${extraContext.length} chars de contexto híbrido extraídos.`);
        } catch (err) {
            logs.push(`STEP 3 ERRO: ${err.message}`);
        }

        // STEP 4: Gerar artigo PT mestre (Claude) — sem response_json_schema para evitar JSON corrompido
        logs.push("STEP 4: Chamando Claude para artigo mestre em PT...");

        const masterPrompt = `Você é um jornalista de tecnologia sênior. Escreva um artigo completo em Português do Brasil.

NOTÍCIA:
Título: ${chosenItem.title}
Conteúdo: ${chosenItem.contentSnippet || chosenItem.summary || ''}

CONTEXTO ADICIONAL:
${extraContext || 'Não disponível.'}

INSTRUÇÕES:
- Mínimo 800 palavras de conteúdo em Markdown
- Use subtítulos ##, listas, negrito
- Inclua uma seção "## III. Matriz Comparativa" com uma tabela Markdown padrão (| Coluna |). REGRAS CRÍTICAS: (1) pule TRÊS linhas em branco antes e depois da tabela; (2) cada linha da tabela deve ser separada por uma quebra de linha real; (3) não use pipes duplos (||) nem espaços colados nos separadores; (4) use 3 concorrentes reais como linhas
- Na seção "## Laboratório LatinoTech", inclua um prompt profissional de 150+ palavras
- Categoria deve ser UMA de: IA, Gadgets, Software, Startups, Gaming, Tech, Tutoriales
- Palavras-chave SEO: 5 a 8 termos separados por vírgula

FORMATO DE RESPOSTA — retorne EXATAMENTE este XML (substitua os valores):
<article>
<title>TÍTULO AQUI</title>
<summary>RESUMO DE 2 LINHAS AQUI</summary>
<category>CATEGORIA AQUI</category>
<seo_keywords>kw1, kw2, kw3</seo_keywords>
<image_prompt>SHORT ENGLISH PROMPT FOR IMAGE</image_prompt>
<content>
CONTEÚDO MARKDOWN COMPLETO AQUI
</content>
</article>`;

        let masterData = null;
        try {
            const masterRaw = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: masterPrompt,
                model: "claude_sonnet_4_6"
            });

            // masterRaw pode ser string ou { response: string }
            const masterText = typeof masterRaw === 'string' ? masterRaw : (masterRaw.response || JSON.stringify(masterRaw));
            logs.push(`STEP 4 RAW len=${masterText.length}, preview="${masterText.substring(0,100)}"`);

            // Parse do XML
            const extractTag = (tag, text) => {
                const m = text.match(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`));
                if (!m) return '';
                // Preserva quebras de linha — não faz trim agressivo
                return m[0].replace(new RegExp(`^<${tag}>\\s*`), '').replace(new RegExp(`\\s*<\\/${tag}>$`), '');
            };

            masterData = {
                title: extractTag('title', masterText),
                summary: extractTag('summary', masterText),
                category: extractTag('category', masterText),
                seo_keywords: extractTag('seo_keywords', masterText),
                image_prompt: extractTag('image_prompt', masterText),
                content: extractTag('content', masterText)
            };

            logs.push(`STEP 4 OK: title="${masterData.title?.substring(0,50)}", content_len=${masterData.content?.length}`);
        } catch (e) {
            logs.push(`STEP 4 ERRO LLM: ${e.message}`);
            return Response.json({ success: false, error: e.message, logs }, { status: 500 });
        }

        if (!masterData.title || !masterData.content) {
            logs.push(`STEP 4 FALHA: campos obrigatórios ausentes. title="${masterData.title}", content_len=${masterData.content?.length}`);
            return Response.json({ success: false, error: "LLM não retornou título ou conteúdo.", logs });
        }

        // STEP 5: Traduções ES e EN em paralelo (modelo padrão, mais rápido)
        logs.push("STEP 5: Traduzindo para ES e EN em paralelo...");

        const buildTransPrompt = (langName) => `Traduza o artigo abaixo do Português para ${langName}. Mantenha toda a formatação Markdown. NÃO resuma. Categoria deve ser uma de: IA, Gadgets, Software, Startups, Gaming, Tech, Tutoriales.

TÍTULO: ${masterData.title}
RESUMO: ${masterData.summary}
CATEGORIA: ${masterData.category}
PALAVRAS-CHAVE: ${masterData.seo_keywords}

CONTEÚDO:
${masterData.content}

FORMATO DE RESPOSTA — retorne EXATAMENTE este XML:
<article>
<title>TÍTULO TRADUZIDO</title>
<summary>RESUMO TRADUZIDO</summary>
<category>${masterData.category}</category>
<seo_keywords>KWS TRADUZIDAS</seo_keywords>
<content>
CONTEÚDO MARKDOWN TRADUZIDO
</content>
</article>`;

        const extractTag = (tag, text) => {
            const m = text.match(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`));
            if (!m) return '';
            return m[0].replace(new RegExp(`^<${tag}>\\s*`), '').replace(new RegExp(`\\s*<\\/${tag}>$`), '');
        };

        let esData = null;
        let enData = null;

        try {
            const [esRaw, enRaw] = await Promise.all([
                base44.asServiceRole.integrations.Core.InvokeLLM({ prompt: buildTransPrompt('Español (LATAM neutro)') }),
                base44.asServiceRole.integrations.Core.InvokeLLM({ prompt: buildTransPrompt('English (US)') })
            ]);

            const esText = typeof esRaw === 'string' ? esRaw : (esRaw.response || '');
            const enText = typeof enRaw === 'string' ? enRaw : (enRaw.response || '');

            esData = {
                title: extractTag('title', esText),
                summary: extractTag('summary', esText),
                category: extractTag('category', esText) || masterData.category,
                seo_keywords: extractTag('seo_keywords', esText),
                content: extractTag('content', esText)
            };
            enData = {
                title: extractTag('title', enText),
                summary: extractTag('summary', enText),
                category: extractTag('category', enText) || masterData.category,
                seo_keywords: extractTag('seo_keywords', enText),
                content: extractTag('content', enText)
            };

            logs.push(`STEP 5 OK: ES="${esData.title?.substring(0,40)}", EN="${enData.title?.substring(0,40)}"`);
        } catch (e) {
            logs.push(`STEP 5 WARN traduções: ${e.message}`);
        }

        const llmResult = { pt: masterData, es: esData, en: enData };

        // STEP 6: Imagem
        logs.push("STEP 6: Gerando imagem...");
        let image_url = "";
        try {
            const imgResp = await base44.asServiceRole.integrations.Core.GenerateImage({
                prompt: (llmResult.pt.image_prompt || "tech editorial photography, modern AI, minimalist, clean") + ", 4k, cinematic"
            });
            image_url = imgResp.url || "";
            logs.push(`STEP 6 OK imagem: ${image_url.substring(0, 60)}`);
        } catch (e) {
            logs.push(`STEP 6 WARN imagem: ${e.message}`);
        }

        // STEP 7: Salvar os 3 artigos
        logs.push("STEP 7: Salvando artigos no BD...");
        const now = new Date().toISOString();
        const createdArticles = {};

        for (const lang of ['pt', 'es', 'en']) {
            const langData = llmResult[lang];
            if (!langData || !langData.title || !langData.content) {
                logs.push(`STEP 7 SKIP ${lang}: dados ausentes.`);
                continue;
            }

            let baseSlug = generateSlug(langData.title);
            let articleSlug = baseSlug;
            let slugCounter = 2;
            while ((await base44.asServiceRole.entities.NewsArticle.filter({ slug: articleSlug })).length > 0) {
                articleSlug = `${baseSlug}-${slugCounter}`;
                slugCounter++;
            }

            const created = await base44.asServiceRole.entities.NewsArticle.create({
                slug: articleSlug,
                title: langData.title,
                summary: langData.summary,
                content: langData.content,
                original_url: chosenItem.link,
                image_url,
                category: langData.category || chosenFeed.category,
                status: "pending",
                seo_keywords: langData.seo_keywords,
                source_name: chosenFeed.name,
                language: lang,
                published_date: now
            });

            createdArticles[lang] = created;
            logs.push(`STEP 7 OK [${lang}]: id=${created.id}, slug="${articleSlug}"`);
        }

        // STEP 8: Telegram
        logs.push("STEP 8: Notificando Telegram...");
        try {
            const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
            if (TELEGRAM_BOT_TOKEN) {
                const chatIds = {
                    es: Deno.env.get("TELEGRAM_CHAT_ID") || "@latinotech",
                    pt: "@latinotechbr",
                    en: "@latinotechen"
                };

                for (const lang of ['pt', 'es', 'en']) {
                    const article = createdArticles[lang];
                    const langData = llmResult[lang];
                    const chatId = chatIds[lang];
                    if (!chatId || !article || !langData) continue;

                    const shortSummary = (langData.summary || '').length > 150
                        ? langData.summary.substring(0, 147) + "..."
                        : (langData.summary || '');

                    let urlPath = `/noticia/${article.slug}`;
                    if (lang === 'pt') urlPath = `/br/noticia/${article.slug}`;
                    if (lang === 'en') urlPath = `/en/news/${article.slug}`;

                    const cta = lang === 'pt' ? 'Leia a notícia completa:' : lang === 'en' ? 'Read the full story:' : 'Lee la noticia completa:';
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
                logs.push("STEP 7 OK: Telegram enviado.");
            } else {
                logs.push("STEP 7 SKIP: TELEGRAM_BOT_TOKEN não definido.");
            }
        } catch (e) {
            logs.push(`STEP 7 WARN Telegram: ${e.message}`);
        }

        logs.push("CONCLUÍDO COM SUCESSO.");
        return Response.json({ success: true, processed: 1, logs });

    } catch (error) {
        logs.push(`ERRO FATAL: ${error.message}`);
        return Response.json({ error: error.message, logs }, { status: 500 });
    }
});