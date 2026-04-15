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
        
        // Ejecutamos como admin/serviceRole porque correrá en background (Cron)
        const feeds = await base44.asServiceRole.entities.RssFeed.list();
        const activeFeeds = feeds.filter(f => f.is_active);
        
        let processedCount = 0;
        const MAX_ITEMS_PER_RUN = 2; // Limite total por execução para evitar Timeout
        
        for (const feed of activeFeeds) {
            if (processedCount >= MAX_ITEMS_PER_RUN) break;
            try {
                const feedData = await parser.parseURL(feed.url);
                // Procesamos solo las 2 más recientes por fuente para optimizar tiempos y créditos
                const items = feedData.items.slice(0, 2);
                
                for (const item of items) {
                    if (processedCount >= MAX_ITEMS_PER_RUN) break;
                    const existing = await base44.asServiceRole.entities.NewsArticle.filter({ original_url: item.link });
                    if (existing.length > 0) continue;
                    
                    let prompt = `Actúa como un periodista experto en tecnología y SEO para LatinoTech IA, un sitio top de noticias estilo TechCrunch.
                    Genera TRES versiones de la siguiente noticia: una en ESPAÑOL (orientada a LATAM), una en PORTUGUÉS (orientada a BRASIL) y una en INGLÉS (orientada a audiencia GLOBAL).
                    El tono debe ser profesional, dinámico, limpio y atractivo. Usa excelente redacción.
                    
                    Noticia original:
                    Título: ${item.title}
                    Resumen original: ${item.contentSnippet || item.content || ''}
                    
                    REGLAS ESTRICTAS PARA EL CONTENIDO:
                    1. Tamaño y Profundidad: Escribe artículos completos, profundos y detallados con al menos 5 a 7 párrafos bien desarrollados.
                    2. Estructura Periodística: El artículo DEBE contener al menos dos o tres subtítulos (usa Markdown ## o ###).
                    3. Contextualización: Expande la noticia. Explica "por qué esto importa".
                    4. Formato: Markdown usando párrafos, subtítulos y negritas (**).
                    5. Tutoriales de IA: Si la noticia es sobre IA, incluye al final una sección de Tutorial & Prompts (en el idioma respectivo). IMPORTANTE: Cuando generes los prompts de ejemplo, TIENEN QUE SER AMPLIOS Y DETALLADOS. Cada prompt debe tener obligatoriamente entre 3 y 5 líneas de longitud, explicando un contexto, una acción y un formato deseado. No escribas prompts de una sola frase.
                    6. Categorías Estrictas: La categoría del artículo DEBE OBLIGATORIAMENTE ser una de estas (exactamente con esta ortografía, independientemente del idioma): "IA", "Startups", "Gadgets", "Software", "Gaming", o "Tutoriales". NO inventes categorías nuevas ni las traduzcas.
                    
                    Devuelve EXCLUSIVAMENTE un JSON válido con la siguiente estructura:
                    - "es": Objeto con { title, summary, content, category, seo_keywords } (en Español)
                    - "pt": Objeto con { title, summary, content, category, seo_keywords } (en Portugués)
                    - "en": Objeto con { title, summary, content, category, seo_keywords } (en Inglés)
                    - "image_prompt": Un prompt de máximo 20 palabras en inglés para generar una imagen sobre este tema.
                    `;

                    if (feed.category === 'Software') {
                      prompt += `\nINSTRUCCIONES OBLIGATORIAS PARA SOFTWARE:
                    - Debes buscar e incluir el nombre de la herramienta, si es gratuita o de pago, y una lista de "Cómo empezar".`;
                    }
                    
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
                            prompt: llmResponse.image_prompt + ", highly detailed, tech news editorial photography, clean white background, modern tech style, 8k resolution, minimalist"
                        });
                        image_url = imgResponse.url;
                    } catch (e) {
                        console.error("Image generation failed:", e);
                    }
                    
                    let esArticle = null;
                    
                    // AQUI ESTÁ A MÁGICA: O LOOP AGORA CRIA AS 3 VERSÕES!
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
                        
                        if (lang === 'es') esArticle = createdArticle;
                    }

                    // Envio automático para o Telegram (apenas versão ES por agora)
                    try {
                        const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
                        const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
                        
                        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID && esArticle) {
                            const shortSummary = llmResponse.es.summary.length > 150 ? llmResponse.es.summary.substring(0, 147) + "..." : llmResponse.es.summary;
                            const telegramMessage = `<b>${llmResponse.es.title}</b>\n\n${shortSummary}\n\n🚀 Lee la noticia completa aquí:\nhttps://latinotechia.com/noticia/${esArticle.slug}`;
                            
                            if (image_url) {
                                await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        chat_id: TELEGRAM_CHAT_ID,
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
                                        chat_id: TELEGRAM_CHAT_ID,
                                        text: telegramMessage,
                                        parse_mode: 'HTML'
                                    })
                                });
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
        return Response.json({ error: error.message }, { status: 500 });
    }
});