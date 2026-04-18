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
        
        let processedCount = 0;
        const MAX_ITEMS_PER_RUN = 2; 
        
        for (const feed of activeFeeds) {
            if (processedCount >= MAX_ITEMS_PER_RUN) break;
            try {
                const feedData = await parser.parseURL(feed.url);
                const items = feedData.items.slice(0, 2);
                
                for (const item of items) {
                    if (processedCount >= MAX_ITEMS_PER_RUN) break;
                    
                    const existing = await base44.asServiceRole.entities.NewsArticle.filter({ original_url: item.link });
                    if (existing.length > 0) continue;
                    
                    const prompt = `Atue como um Arquiteto de Software e Jornalista Investigativo de Tecnologia para a LatinoTech IA. 
Você recebeu esta pauta bruta:
TÍTULO: ${item.title}
RESUMO: ${item.contentSnippet || item.content || ''}

Sua missão é criar um "Artigo de Autoridade Máxima" (Mínimo de 1000 palavras). O texto deve ser tão denso e técnico que um desenvolvedor sênior sinta que aprendeu algo novo.

ESTRUTURA OBRIGATÓRIA (Siga à risca):

1. INTRODUÇÃO SEM CLICHÊS: 
Comece com um fato, um número ou um problema técnico real. Proibido começar com frases genéricas.

2. ## O Problema da Abordagem Tradicional:
Explique como as empresas resolviam isso antes. Mostre por que a solução antiga faliu ou é ineficiente.

3. ## Deep Dive: Arquitetura e Funcionamento:
Esta é a parte mais longa. NÃO seja genérico. 
- Especule e descreva a stack provável (ex: Uso de Whisper para áudio, GPT-4o para estruturação de JSON, modelos de LangChain para orquestração).
- Explique o passo a passo técnico.
- Inclua um bloco de código (Markdown) mostrando um exemplo de como o JSON de saída ou o comando de API deve ser estruturado.

4. ## Impacto no Ecossistema B2B e Startups:
Analise como isso muda o custo de operação (OPEX). Fale sobre escalabilidade e integração.

5. ## Vantagens, Desafios e "Pegadinhas":
- Liste as vantagens reais.
- Liste os DESAFIOS TÉCNICOS (ex: latência de API, custo de tokens, segurança de dados sensíveis). Seja honesto sobre as limitações.

6. > CITAÇÃO DE IMPACTO: Crie uma frase poderosa que resuma a disrupção técnica desta notícia. (Use o formato > do Markdown).

7. ## O Veredicto da LatinoTech:
Dê uma opinião editorial forte. O que as empresas devem fazer AGORA? Adotar, esperar ou observar?

REGRAS DE OURO:
- Use termos técnicos avançados.
- Formatação Markdown rica com muitos subtítulos (## e ###).
- TRADUÇÃO: Gere versões completas em 'es', 'pt' e 'en'.

Devolva EXCLUSIVAMENTE um objeto JSON válido:
{
  "es": { "title": "", "summary": "2 linhas fortes e diretas", "content": "Texto MASSIVO, longo e TÉCNICO em Markdown", "category": "", "seo_keywords": "" },
  "pt": { "title": "", "summary": "2 linhas fortes e diretas", "content": "Texto MASSIVO, longo e TÉCNICO em Markdown", "category": "", "seo_keywords": "" },
  "en": { "title": "", "summary": "2 linhas fortes e diretas", "content": "Texto MASSIVO, longo e TÉCNICO em Markdown", "category": "", "seo_keywords": "" },
  "image_prompt": "Cinematic tech editorial photography, hyper-realistic, 8k."
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