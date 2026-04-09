import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Parser from 'npm:rss-parser';

const parser = new Parser();

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
                    Reescribe la siguiente noticia en español, orientada al público de Latinoamérica.
                    El tono debe ser profesional, dinámico, limpio y atractivo. Usa excelente redacción.
                    
                    Noticia original:
                    Título: ${item.title}
                    Resumen original: ${item.contentSnippet || item.content || ''}
                    
                    REGLAS ESTRICTAS PARA EL CONTENIDO (content):
                    1. Tamaño y Profundidad: Escribe un artículo completo, profundo y detallado con al menos 5 a 7 párrafos bien desarrollados. ESTÁ ESTRICTAMENTE PROHIBIDO hacer resúmenes cortos.
                    2. Estructura Periodística: El artículo DEBE contener al menos dos o tres subtítulos (usa Markdown ## o ### equivalentes a <h2>/<h3>) para organizar la lectura y mejorar el SEO.
                    3. Contextualización: Expande la noticia. Explica "por qué esto importa", "cuál es el impacto en el mercado latino/global" y "qué cambia para el usuario final".
                    4. Formato: El contenido debe estar formateado en Markdown usando párrafos, subtítulos (##/###) y negritas (**) en las palabras clave importantes.
                    
                    Devuelve EXCLUSIVAMENTE un JSON válido con:
                    - title: Título hiper atractivo y optimizado para SEO (clickbait elegante)
                    - summary: Resumen de 2 líneas exactas que atrape al lector
                    - content: El artículo completo siguiendo las REGLAS ESTRICTAS descritas arriba.
                    - seo_keywords: 5 a 7 palabras clave separadas por coma
                    - image_prompt: Un prompt de máximo 20 palabras en inglés para generar una imagen hiperrealista y limpia estilo editorial de tecnología sobre este tema.
                    `;

                    if (feed.category === 'Software') {
                      prompt += `\nINSTRUCCIONES OBLIGATORIAS PARA CATEGORÍA SOFTWARE:
                    - Debes buscar e incluir el nombre de la herramienta.
                    - Debes indicar claramente si es gratuita o de pago.
                    - Debes incluir una breve sección o lista de "Cómo empezar" (How to start).
                    - El 'summary' debe estar enfocado en la utilidad práctica de la herramienta para el usuario.`;
                    }
                    
                    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
                        prompt: prompt,
                        response_json_schema: {
                            type: "object",
                            properties: {
                                title: { type: "string" },
                                summary: { type: "string" },
                                content: { type: "string" },
                                seo_keywords: { type: "string" },
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
                    
                    await base44.asServiceRole.entities.NewsArticle.create({
                        title: llmResponse.title,
                        summary: llmResponse.summary,
                        content: llmResponse.content,
                        original_url: item.link,
                        image_url: image_url,
                        category: feed.category,
                        status: "pending", // Queda pendiente para aprobación del Admin
                        seo_keywords: llmResponse.seo_keywords,
                        source_name: feed.name,
                        published_date: new Date().toISOString()
                    });
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