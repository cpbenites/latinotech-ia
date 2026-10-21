import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Parser from 'npm:rss-parser';

const parser = new Parser({ timeout: 8000 });

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

async function fetchWithTimeout(fetchFn, timeoutMs, fallback = "") {
    try {
        const result = await Promise.race([
            fetchFn(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs))
        ]);
        return result;
    } catch {
        return fallback;
    }
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

        // LIMITE DIÁRIO — usa created_date com filtro por data de hoje (UTC-4 Asuncion)
        const DAILY_LIMIT_PER_LANG = 5;
        const now = new Date();
        // Início do dia em America/Asuncion (UTC-4)
        const todayLocalStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Asuncion' }); // YYYY-MM-DD
        const todayStartUTC = new Date(todayLocalStr + 'T04:00:00.000Z'); // meia-noite Asuncion = 04:00 UTC
        const todayStr = todayStartUTC.toISOString();

        logs.push(`LIMITE: contando artigos criados após ${todayStr}`);

        // Busca apenas artigos de hoje (pending OU published), para evitar que pendentes antigos distorçam a contagem
        const [allPt, allEs, allEn] = await Promise.all([
            base44.asServiceRole.entities.NewsArticle.filter({ language: 'pt' }, '-created_date', 20),
            base44.asServiceRole.entities.NewsArticle.filter({ language: 'es' }, '-created_date', 20),
            base44.asServiceRole.entities.NewsArticle.filter({ language: 'en' }, '-created_date', 20),
        ]);

        const countToday = (articles) => articles.filter(a => a.created_date && a.created_date >= todayStr && a.status !== 'rejected').length;
        const ptToday = countToday(allPt);
        const esToday = countToday(allEs);
        const enToday = countToday(allEn);

        logs.push(`LIMITE DIÁRIO: PT=${ptToday}, ES=${esToday}, EN=${enToday} (limite: ${DAILY_LIMIT_PER_LANG} cada)`);

        if (ptToday >= DAILY_LIMIT_PER_LANG && esToday >= DAILY_LIMIT_PER_LANG && enToday >= DAILY_LIMIT_PER_LANG) {
            logs.push("LIMITE ATINGIDO: Já foram gerados 3 artigos por idioma hoje. Abortando.");
            return Response.json({ success: true, processed: 0, message: "Limite diário de 9 artigos atingido.", logs });
        }

        // STEP 2: Encontrar 1 item novo
        const shuffledFeeds = [...activeFeeds].sort(() => Math.random() - 0.5);
        let chosenFeed = null;
        let chosenItem = null;

        logs.push("STEP 2: Procurando item novo não duplicado...");
        for (const feed of shuffledFeeds) {
            try {
                const feedData = await fetchWithTimeout(
                    () => parser.parseURL(feed.url),
                    8000,
                    null
                );
                if (!feedData) continue;

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
            logs.push("STEP 2: Nenhum item novo encontrado.");
            return Response.json({ success: true, processed: 0, message: "Sem novos itens.", logs });
        }
        logs.push(`STEP 2 OK: "${chosenItem.title}" de "${chosenFeed.name}"`);

        // STEP 3: Contexto extra — Jina (artigo original completo) + Exa (fontes complementares)
        logs.push("STEP 3: Buscando artigo original com Jina...");

        const jinaContext = await fetchWithTimeout(async () => {
            const jinaApiKey = Deno.env.get("JINA_API_KEY");
            const jinaHeaders = jinaApiKey ? { "Authorization": `Bearer ${jinaApiKey}` } : {};
            const res = await fetch(`https://r.jina.ai/${chosenItem.link}`, { headers: jinaHeaders });
            if (!res.ok) return "";
            const text = await res.text();
            return text ? `\n--- ARTIGO ORIGINAL COMPLETO ---\n${text.substring(0, 8000)}` : "";
        }, 12000, "");

        logs.push("STEP 3b: Buscando fontes complementares com Exa...");
        const exaContext = await fetchWithTimeout(async () => {
            const exaApiKey = Deno.env.get("EXA_API_KEY");
            if (!exaApiKey) return "";
            const res = await fetch("https://api.exa.ai/search", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-api-key": exaApiKey },
                body: JSON.stringify({
                    query: chosenItem.title,
                    numResults: 5,
                    type: "auto",
                    contents: { text: { maxCharacters: 2000 } }
                })
            });
            if (!res.ok) return "";
            const data = await res.json();
            const results = data.results || [];
            if (results.length === 0) return "";
            return "\n--- FONTES COMPLEMENTARES (EXA) ---\n" + results
                .map((r, i) => `[${i + 1}] ${r.title || ""} (${r.url || ""})\n${(r.text || "").substring(0, 1500)}`)
                .join("\n\n");
        }, 15000, "");

        const extraContext = jinaContext + exaContext;

        logs.push(`STEP 3 OK: ${jinaContext.length} chars Jina + ${exaContext.length} chars Exa.`);

        // STEP 3c: BRIEFING EDITORIAL — análise das fontes ANTES da redação (modelo econômico)
        logs.push("STEP 3c: Montando briefing editorial a partir das fontes...");
        let briefing = "";
        try {
            const briefingPrompt = `Você é um editor-chefe de tecnologia. Sua tarefa NÃO é escrever o artigo, e sim produzir um BRIEFING EDITORIAL rigoroso que servirá de base para outro redator.

NOTÍCIA:
Título: ${chosenItem.title}
Resumo da fonte: ${chosenItem.contentSnippet || chosenItem.summary || 'não informado'}

MATERIAL BRUTO (fonte original + fontes complementares):
${extraContext || 'Não disponível.'}

Produza o briefing em tópicos, em português, com exatamente estas seções:
1. FATOS CONFIRMADOS — só o que aparece explicitamente nas fontes, mantendo números, datas e nomes exatos.
2. NÚMEROS, DATAS E NOMES — lista dos dados concretos disponíveis.
3. CRONOLOGIA — o que aconteceu antes e leva a este fato.
4. QUEM É AFETADO — empresas, setores, usuários e de que forma.
5. CONTRADIÇÕES E DIVERGÊNCIAS — onde as fontes discordam ou não confirmam.
6. PONTOS EM ABERTO — o que ainda não se sabe e o que falta confirmar.
7. ÂNGULOS RELEVANTES — de 3 a 5 aspectos que o artigo deve explicar (impacto prático, custo, adoção, regulação, concorrência).
8. QUALIDADE DO MATERIAL — responda apenas "RICO" ou "LIMITADO", indicando se há dados suficientes para um artigo aprofundado.

Regra absoluta: não invente nada. Se algo não estiver no material, escreva "não informado".`;

            const briefingRaw = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: briefingPrompt,
                model: "gemini_3_flash"
            });
            briefing = typeof briefingRaw === 'string' ? briefingRaw : (briefingRaw.response || JSON.stringify(briefingRaw));
            logs.push(`STEP 3c OK: briefing com ${briefing.length} chars.`);
        } catch (e) {
            logs.push(`STEP 3c WARN briefing: ${e.message}`);
        }

        // STEP 4: Gerar artigo mestre PT + traduções ES/EN
        logs.push("STEP 4: Gerando artigo mestre PT (modelo avançado) + traduções ES/EN...");

        const masterPrompt = `Você é um jornalista de tecnologia sênior. Escreva um artigo jornalístico aprofundado em Português do Brasil.

NOTÍCIA PRINCIPAL:
Título: ${chosenItem.title}
Conteúdo: ${chosenItem.contentSnippet || chosenItem.summary || ''}

BRIEFING EDITORIAL (base factual já analisada — use como fonte primária de fatos):
${briefing || 'Não disponível.'}

MATERIAL DE APOIO (fonte original e fontes complementares, para consulta e detalhes adicionais):
${extraContext || 'Não disponível.'}

INSTRUÇÕES DE PROFUNDIDADE (a parte mais importante):
- Escreva entre 1100 e 1500 palavras em Markdown.
- Cada parágrafo deve trazer informação concreta. É proibido usar frases genéricas de preenchimento ("a tecnologia está transformando o mundo", "isso muda tudo").
- Não repita a mesma ideia em parágrafos diferentes.
- Explique sempre quatro coisas: o que aconteceu, por que importa, quem é afetado e de que forma.
- Traga exemplos concretos e consequências práticas para o leitor (custo, tempo, adoção, risco, oportunidade).
- Use exatamente os números, datas, versões, preços e nomes do briefing. Não arredonde nem invente.
- Onde o briefing apontar contradição ou ponto em aberto, deixe isso explícito no texto em vez de escolher uma versão sem avisar.
- Se o briefing indicar material LIMITADO, escreva um texto mais curto e preciso — nunca encha linguiça.
- Nunca invente fatos, números, citações, nomes ou declarações.

ESTRUTURA OBRIGATÓRIA:
  1. Lead: parágrafo de abertura que resume o essencial.
  2. Subtítulos ## organizando o desenvolvimento.
  3. Contexto e antecedentes: a cronologia de como se chegou a isso.
  4. Dados concretos: números, datas, nomes e versões.
  5. Impacto para o setor, para os usuários e para o mercado latino-americano.
  6. "## O que ainda não se sabe" — pontos em aberto e o que falta confirmar.
  7. "## O que esperar a seguir" — próximos passos concretos.
  8. "## Perguntas frequentes" com 3 perguntas e respostas curtas.
- Use listas com marcadores e negrito para destacar pontos-chave.
- Tom jornalístico, claro e objetivo.
- Categoria deve ser UMA de: IA, Gadgets, Software, Startups, Gaming, Tech, Tutoriales
- Palavras-chave SEO: 5 a 8 termos separados por vírgula

FORMATO DE RESPOSTA — retorne EXATAMENTE este XML:
<article>
<title>TÍTULO EM PT</title>
<summary>RESUMO DE 2 LINHAS</summary>
<category>CATEGORIA</category>
<seo_keywords>kw1, kw2, kw3</seo_keywords>
<image_prompt>SHORT ENGLISH PROMPT FOR IMAGE GENERATION</image_prompt>
<content>
CONTEÚDO MARKDOWN COMPLETO
</content>
</article>`;

        const translatePrompt = (langName, ptTitle, ptSummary, ptCategory, ptKeywords, ptContent) =>
            `Traduza do Português para ${langName}. Mantenha toda a formatação Markdown. NÃO resuma. Categoria deve ser uma de: IA, Gadgets, Software, Startups, Gaming, Tech, Tutoriales.

TÍTULO: ${ptTitle}
RESUMO: ${ptSummary}
CATEGORIA: ${ptCategory}
PALAVRAS-CHAVE: ${ptKeywords}

CONTEÚDO:
${ptContent}

FORMATO — retorne EXATAMENTE este XML:
<article>
<title>TÍTULO TRADUZIDO</title>
<summary>RESUMO TRADUZIDO</summary>
<category>${ptCategory}</category>
<seo_keywords>KWS TRADUZIDAS</seo_keywords>
<content>
CONTEÚDO MARKDOWN TRADUZIDO
</content>
</article>`;

        const extractTag = (tag, text) => {
            const m = text.match(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`));
            if (!m) return '';
            return m[0].replace(`<${tag}>`, '').replace(`</${tag}>`, '').trim();
        };

        // Gerar artigo mestre PT
        let masterData = null;
        try {
            const masterRaw = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: masterPrompt,
                model: "gemini_3_1_pro"
            });
            const masterText = typeof masterRaw === 'string' ? masterRaw : (masterRaw.response || JSON.stringify(masterRaw));
            masterData = {
                title: extractTag('title', masterText),
                summary: extractTag('summary', masterText),
                category: extractTag('category', masterText),
                seo_keywords: extractTag('seo_keywords', masterText),
                image_prompt: extractTag('image_prompt', masterText),
                content: extractTag('content', masterText)
            };
            logs.push(`STEP 4 OK PT: title="${masterData.title?.substring(0, 50)}", len=${masterData.content?.length}`);
        } catch (e) {
            logs.push(`STEP 4 ERRO LLM PT: ${e.message}`);
            return Response.json({ success: false, error: e.message, logs }, { status: 500 });
        }

        if (!masterData.title || !masterData.content) {
            logs.push("STEP 4 FALHA: campos obrigatórios ausentes.");
            return Response.json({ success: false, error: "LLM não retornou título ou conteúdo.", logs });
        }

        // Traduções ES e EN em paralelo
        logs.push("STEP 5: Traduzindo para ES e EN em paralelo...");
        let esData = null;
        let enData = null;

        try {
            const [esRaw, enRaw] = await Promise.all([
                base44.asServiceRole.integrations.Core.InvokeLLM({
                    prompt: translatePrompt('Español (LATAM neutro)', masterData.title, masterData.summary, masterData.category, masterData.seo_keywords, masterData.content),
                    model: "gemini_3_flash"
                }),
                base44.asServiceRole.integrations.Core.InvokeLLM({
                    prompt: translatePrompt('English (US)', masterData.title, masterData.summary, masterData.category, masterData.seo_keywords, masterData.content),
                    model: "gemini_3_flash"
                })
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
            logs.push(`STEP 5 OK: ES="${esData.title?.substring(0, 40)}", EN="${enData.title?.substring(0, 40)}"`);
        } catch (e) {
            logs.push(`STEP 5 WARN traduções: ${e.message}`);
        }

        // STEP 6: Imagem com timeout curto (15s)
        logs.push("STEP 6: Gerando imagem...");
        let image_url = "";
        try {
            const imgResp = await fetchWithTimeout(
                () => base44.asServiceRole.integrations.Core.GenerateImage({
                    prompt: (masterData.image_prompt || "tech editorial photography, modern AI, minimalist") + ", 4k, cinematic"
                }),
                15000,
                null
            );
            image_url = imgResp?.url || "";
            logs.push(`STEP 6 OK imagem: ${image_url.substring(0, 60)}`);
        } catch (e) {
            logs.push(`STEP 6 WARN imagem: ${e.message}`);
        }

        // STEP 7: Salvar os 3 artigos
        logs.push("STEP 7: Salvando artigos...");
        const saveNow = new Date().toISOString();
        const createdArticles = {};
        const llmResult = { pt: masterData, es: esData, en: enData };

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
                published_date: saveNow
            });

            createdArticles[lang] = created;
            logs.push(`STEP 7 OK [${lang}]: slug="${articleSlug}"`);
        }

        // STEP 8: Telegram — fire and forget
        logs.push("STEP 8: Enviando Telegram (async)...");
        const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
        if (TELEGRAM_BOT_TOKEN) {
            const chatIds = {
                es: Deno.env.get("TELEGRAM_CHAT_ID") || "@latinotech",
                pt: "@latinotechbr",
                en: "@latinotechen"
            };

            // Fire and forget — não bloqueia nem falha o processo principal
            Promise.all(['pt', 'es', 'en'].map(async (lang) => {
                const article = createdArticles[lang];
                const langData = llmResult[lang];
                const chatId = chatIds[lang];
                if (!chatId || !article || !langData) return;

                const shortSummary = (langData.summary || '').substring(0, 150);
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
            })).catch(e => console.warn("Telegram error:", e.message));
        } else {
            logs.push("STEP 8 SKIP: TELEGRAM_BOT_TOKEN não definido.");
        }

        logs.push("CONCLUÍDO COM SUCESSO.");
        return Response.json({ success: true, processed: 1, logs });

    } catch (error) {
        logs.push(`ERRO FATAL: ${error.message}`);
        return Response.json({ error: error.message, logs }, { status: 500 });
    }
});