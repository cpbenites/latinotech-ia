import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Parser from 'npm:rss-parser';
import { generateSlug, fetchWithTimeout, extractTag, buildTranslatePrompt } from '../../shared/editorial.ts';

const parser = new Parser({ timeout: 6000 });

// Temas fixos da rotação semanal
const THEMES = [
    {
        id: "utilitarios",
        label: "Utilitários interativos de IA e SaaS",
        category: "Software",
        queries: [
            "novas ferramentas SaaS de IA lançadas recentemente",
            "calculadora de custos de API de IA preço por token",
            "comparativo de softwares SaaS para empresas e produtividade"
        ],
        angle: "Apresente a ferramenta, o problema que ela resolve, quanto custa, como se compara com as alternativas do mercado e como o leitor pode usar na prática."
    },
    {
        id: "financas",
        label: "Gestão de dívidas e finanças pessoais",
        category: "Tech",
        queries: [
            "aplicativos para sair das dívidas e controlar finanças pessoais",
            "renegociação de dívidas e planejamento financeiro pessoal",
            "ferramentas digitais de orçamento familiar e investimentos"
        ],
        angle: "Explique o problema financeiro, os números e taxas envolvidos, as opções disponíveis e o passo a passo prático para o leitor resolver."
    },
    {
        id: "b2b",
        label: "Produtividade e automação B2B",
        category: "Software",
        queries: [
            "automação de processos empresariais com inteligência artificial",
            "ferramentas de produtividade para equipes e empresas",
            "integração de sistemas e automação de fluxo de trabalho B2B"
        ],
        angle: "Mostre o processo que está sendo automatizado, o ganho concreto de tempo ou custo, as ferramentas envolvidas e como uma empresa implementa isso."
    }
];

export default async function (req) {
    const base44 = createClientFromRequest(req);
    const logs = [];

    try {
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

        // STEP 1: escolher o tema da vez na rotação
        logs.push("STEP 1: Lendo estado da rotação de temas...");
        const rotationList = await base44.asServiceRole.entities.TopicRotation.filter({ key: 'default' });
        const rotation = rotationList[0] || null;

        let nextIndex = 0;
        if (rotation && rotation.last_theme) {
            const lastIdx = THEMES.findIndex(t => t.id === rotation.last_theme);
            nextIndex = lastIdx === -1 ? 0 : (lastIdx + 1) % THEMES.length;
        }
        const theme = THEMES[nextIndex];
        logs.push(`STEP 1 OK: tema da vez = "${theme.label}" (${theme.id})`);

        // STEP 2: candidatos dos feeds RSS ativos
        logs.push("STEP 2: Coletando candidatos dos feeds RSS...");
        const feeds = await base44.asServiceRole.entities.RssFeed.list();
        const activeFeeds = feeds.filter(f => f.is_active).slice(0, 10);

        const rssCandidates = [];
        const feedResults = await Promise.allSettled(
            activeFeeds.map(feed => fetchWithTimeout(() => parser.parseURL(feed.url), 6000, null)
                .then(data => ({ feed, data })))
        );

        for (const r of feedResults) {
            if (r.status !== 'fulfilled' || !r.value || !r.value.data) continue;
            const { feed, data } = r.value;
            for (const item of (data.items || []).slice(0, 3)) {
                if (!item.link || !item.title) continue;
                rssCandidates.push({
                    title: item.title,
                    url: item.link,
                    source_name: feed.name,
                    snippet: (item.contentSnippet || item.summary || '').substring(0, 400)
                });
            }
        }
        logs.push(`STEP 2 OK: ${rssCandidates.length} candidatos de ${activeFeeds.length} feeds.`);

        // STEP 3: candidatos da pesquisa na web (Exa), por tema
        logs.push("STEP 3: Pesquisando na web por pautas do tema...");
        const exaApiKey = Deno.env.get("EXA_API_KEY");
        const webCandidates = [];
        if (exaApiKey) {
            const searchResults = await Promise.allSettled(
                theme.queries.map(q => fetchWithTimeout(async () => {
                    const res = await fetch("https://api.exa.ai/search", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "x-api-key": exaApiKey },
                        body: JSON.stringify({
                            query: q,
                            numResults: 4,
                            type: "auto",
                            contents: { text: { maxCharacters: 1200 } }
                        })
                    });
                    if (!res.ok) return [];
                    const data = await res.json();
                    return data.results || [];
                }, 15000, []))
            );

            for (const r of searchResults) {
                if (r.status !== 'fulfilled' || !r.value) continue;
                for (const item of r.value) {
                    if (!item.url || !item.title) continue;
                    webCandidates.push({
                        title: item.title,
                        url: item.url,
                        source_name: new URL(item.url).hostname.replace('www.', ''),
                        snippet: (item.text || '').substring(0, 400)
                    });
                }
            }
        } else {
            logs.push("STEP 3 WARN: EXA_API_KEY não definida, seguindo apenas com feeds.");
        }
        logs.push(`STEP 3 OK: ${webCandidates.length} candidatos da web.`);

        // STEP 4: escolher a melhor pauta do tema (feeds + web combinados)
        const seenUrls = new Set();
        const candidates = [...rssCandidates, ...webCandidates]
            .filter(c => {
                if (seenUrls.has(c.url)) return false;
                seenUrls.add(c.url);
                return true;
            })
            .slice(0, 30);

        if (candidates.length === 0) {
            logs.push("STEP 4: Nenhum candidato disponível.");
            return Response.json({ success: true, processed: 0, message: "Sem candidatos.", logs });
        }

        const candidateList = candidates
            .map((c, i) => `[${i + 1}] ${c.title}\nURL: ${c.url}\nFonte: ${c.source_name}\nTrecho: ${c.snippet}`)
            .join("\n\n");

        logs.push("STEP 4: Selecionando a melhor pauta para o tema...");
        const selectionPrompt = `Você é um editor de um portal de tecnologia. Escolha UM único assunto, entre os candidatos abaixo, para virar uma matéria aprofundada.

TEMA OBRIGATÓRIO DESTA EDIÇÃO: ${theme.label}
ÂNGULO ESPERADO: ${theme.angle}

CANDIDATOS:
${candidateList}

Regras:
- Escolha o candidato com MAIS informação concreta (números, preços, versões, datas, nomes de empresas e produtos).
- Prefira assuntos com impacto prático e atual para o público de tecnologia e IA.
- Evite notas curtas, opinião solta, política partidária e conteúdo puramente promocional.
- O campo <url> deve ser EXATAMENTE uma das URLs listadas acima.

FORMATO — retorne EXATAMENTE este XML:
<topic>
<title>TÍTULO ESCOLHIDO</title>
<url>URL ESCOLHIDA</url>
<source_name>NOME DA FONTE</source_name>
<reason>UMA FRASE EXPLICANDO A ESCOLHA</reason>
</topic>`;

        let chosen = null;
        try {
            const selRaw = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: selectionPrompt,
                model: "gemini_3_flash"
            });
            const selText = typeof selRaw === 'string' ? selRaw : (selRaw.response || JSON.stringify(selRaw));
            const selUrl = extractTag('url', selText);
            const selTitle = extractTag('title', selText);
            const match = candidates.find(c => c.url === selUrl);
            if (match) {
                chosen = match;
            } else if (selTitle) {
                chosen = candidates.find(c => c.title === selTitle) || null;
            }
            if (chosen) logs.push(`STEP 4 OK: "${chosen.title}" (${chosen.source_name}) — ${extractTag('reason', selText)}`);
        } catch (e) {
            logs.push(`STEP 4 WARN seleção: ${e.message}`);
        }

        if (!chosen) {
            chosen = candidates[0];
            logs.push(`STEP 4 FALLBACK: usando o primeiro candidato "${chosen.title}".`);
        }

        // Evita duplicata: mesmo assunto já gerado antes
        const already = await base44.asServiceRole.entities.NewsArticle.filter({ original_url: chosen.url });
        if (already.length > 0) {
            logs.push(`STEP 4 SKIP: pauta já publicada anteriormente (${chosen.url}).`);
            return Response.json({ success: true, processed: 0, message: "Pauta já existente.", logs });
        }

        // STEP 5: apuração — artigo original (Jina) + fontes complementares (Exa)
        logs.push("STEP 5: Apurando o artigo original com Jina...");
        const jinaContext = await fetchWithTimeout(async () => {
            const jinaApiKey = Deno.env.get("JINA_API_KEY");
            const jinaHeaders = jinaApiKey ? { "Authorization": `Bearer ${jinaApiKey}` } : {};
            const res = await fetch(`https://r.jina.ai/${chosen.url}`, { headers: jinaHeaders });
            if (!res.ok) return "";
            const text = await res.text();
            return text ? `\n--- ARTIGO ORIGINAL COMPLETO ---\n${text.substring(0, 8000)}` : "";
        }, 15000, "");

        logs.push("STEP 5b: Buscando fontes complementares com Exa...");
        const exaContext = await fetchWithTimeout(async () => {
            if (!exaApiKey) return "";
            const res = await fetch("https://api.exa.ai/search", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-api-key": exaApiKey },
                body: JSON.stringify({
                    query: chosen.title,
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
        logs.push(`STEP 5 OK: ${jinaContext.length} chars Jina + ${exaContext.length} chars Exa.`);

        // STEP 6: briefing editorial antes da redação
        logs.push("STEP 6: Montando briefing editorial a partir das fontes...");
        let briefing = "";
        try {
            const briefingPrompt = `Você é um editor-chefe de tecnologia. Sua tarefa NÃO é escrever o artigo, e sim produzir um BRIEFING EDITORIAL rigoroso que servirá de base para outro redator.

TEMA DESTA EDIÇÃO: ${theme.label}
ÂNGULO ESPERADO: ${theme.angle}

PAUTA:
Título: ${chosen.title}
Fonte: ${chosen.source_name} (${chosen.url})
Resumo: ${chosen.snippet}

MATERIAL BRUTO (fonte original + fontes complementares):
${extraContext || 'Não disponível.'}

Produza o briefing em tópicos, em português, com exatamente estas seções:
1. FATOS CONFIRMADOS — só o que aparece explicitamente nas fontes, mantendo números, datas e nomes exatos.
2. NÚMEROS, DATAS E NOMES — lista dos dados concretos disponíveis (preços, versões, prazos, taxas, empresas).
3. CRONOLOGIA — o que aconteceu antes e leva a este fato.
4. QUEM É AFETADO — empresas, setores, usuários e de que forma.
5. CONTRADIÇÕES E DIVERGÊNCIAS — onde as fontes discordam ou não confirmam.
6. PONTOS EM ABERTO — o que ainda não se sabe e o que falta confirmar.
7. APLICAÇÃO PRÁTICA — o passo a passo ou o comparativo que o leitor pode usar hoje.
8. ÂNGULOS RELEVANTES — de 3 a 5 aspectos que o artigo deve explicar.
9. QUALIDADE DO MATERIAL — responda apenas "RICO" ou "LIMITADO", indicando se há dados suficientes para um artigo aprofundado.

Regra absoluta: não invente nada. Se algo não estiver no material, escreva "não informado".`;

            const briefingRaw = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: briefingPrompt,
                model: "gemini_3_flash"
            });
            briefing = typeof briefingRaw === 'string' ? briefingRaw : (briefingRaw.response || JSON.stringify(briefingRaw));
            logs.push(`STEP 6 OK: briefing com ${briefing.length} chars.`);
        } catch (e) {
            logs.push(`STEP 6 WARN briefing: ${e.message}`);
        }

        // STEP 7: artigo mestre PT
        logs.push("STEP 7: Gerando artigo mestre PT (modelo avançado)...");
        const masterPrompt = `Você é um jornalista de tecnologia sênior. Escreva um artigo jornalístico aprofundado em Português do Brasil.

TEMA DESTA EDIÇÃO: ${theme.label}
ÂNGULO ESPERADO: ${theme.angle}

PAUTA PRINCIPAL:
Título: ${chosen.title}
Fonte: ${chosen.source_name}

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
  4. Dados concretos: números, datas, nomes, versões e preços.
  5. Aplicação prática: como o leitor ou a empresa usa isso (passo a passo ou comparativo).
  6. Impacto para o setor, para os usuários e para o mercado latino-americano.
  7. "## O que ainda não se sabe" — pontos em aberto e o que falta confirmar.
  8. "## O que esperar a seguir" — próximos passos concretos.
  9. "## Perguntas frequentes" com 3 perguntas e respostas curtas.
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
            logs.push(`STEP 7 OK PT: title="${masterData.title?.substring(0, 60)}", len=${masterData.content?.length}`);
        } catch (e) {
            logs.push(`STEP 7 ERRO LLM PT: ${e.message}`);
            return Response.json({ success: false, error: e.message, logs }, { status: 500 });
        }

        if (!masterData.title || !masterData.content) {
            logs.push("STEP 7 FALHA: campos obrigatórios ausentes.");
            return Response.json({ success: false, error: "LLM não retornou título ou conteúdo.", logs });
        }

        // STEP 8: traduções ES e EN
        logs.push("STEP 8: Traduzindo para ES e EN em paralelo...");
        let esData = null;
        let enData = null;
        try {
            const [esRaw, enRaw] = await Promise.all([
                base44.asServiceRole.integrations.Core.InvokeLLM({
                    prompt: buildTranslatePrompt('Español (LATAM neutro)', masterData),
                    model: "gemini_3_flash"
                }),
                base44.asServiceRole.integrations.Core.InvokeLLM({
                    prompt: buildTranslatePrompt('English (US)', masterData),
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
            logs.push(`STEP 8 OK: ES="${esData.title?.substring(0, 40)}", EN="${enData.title?.substring(0, 40)}"`);
        } catch (e) {
            logs.push(`STEP 8 WARN traduções: ${e.message}`);
        }

        // STEP 9: imagem
        logs.push("STEP 9: Gerando imagem...");
        let image_url = "";
        try {
            const imgResp = await fetchWithTimeout(
                () => base44.asServiceRole.integrations.Core.GenerateImage({
                    prompt: (masterData.image_prompt || "tech editorial photography, modern software, minimalist") + ", 4k, cinematic"
                }),
                15000,
                null
            );
            image_url = imgResp?.url || "";
            logs.push(`STEP 9 OK imagem: ${image_url.substring(0, 60)}`);
        } catch (e) {
            logs.push(`STEP 9 WARN imagem: ${e.message}`);
        }

        // STEP 10: salvar as 3 versões como PENDENTES (aguardando aprovação)
        logs.push("STEP 10: Salvando artigos como pendentes...");
        const saveNow = new Date().toISOString();
        const createdArticles = {};
        const llmResult = { pt: masterData, es: esData, en: enData };

        for (const lang of ['pt', 'es', 'en']) {
            const langData = llmResult[lang];
            if (!langData || !langData.title || !langData.content) {
                logs.push(`STEP 10 SKIP ${lang}: dados ausentes.`);
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
                original_url: chosen.url,
                image_url,
                category: langData.category || theme.category,
                status: "pending",
                seo_keywords: langData.seo_keywords,
                source_name: chosen.source_name,
                language: lang,
                published_date: saveNow
            });

            createdArticles[lang] = created;
            logs.push(`STEP 10 OK [${lang}]: slug="${articleSlug}"`);
        }

        // STEP 11: registrar o tema usado, para a próxima execução alternar
        logs.push("STEP 11: Atualizando rotação de temas...");
        const rotationData = {
            key: 'default',
            last_theme: theme.id,
            last_run: saveNow,
            runs_count: (rotation?.runs_count || 0) + 1
        };
        if (rotation) {
            await base44.asServiceRole.entities.TopicRotation.update(rotation.id, rotationData);
        } else {
            await base44.asServiceRole.entities.TopicRotation.create(rotationData);
        }
        logs.push(`STEP 11 OK: rotação agora em "${theme.id}" (execução ${rotationData.runs_count}).`);

        logs.push("CONCLUÍDO COM SUCESSO.");
        return Response.json({
            success: true,
            processed: 1,
            theme: theme.label,
            topic: chosen.title,
            logs
        });

    } catch (error) {
        logs.push(`ERRO FATAL: ${error.message}`);
        return Response.json({ error: error.message, logs }, { status: 500 });
    }
}