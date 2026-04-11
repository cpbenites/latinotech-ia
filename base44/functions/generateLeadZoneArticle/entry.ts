import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
        
        const angles = [
            "Ángulo A: El fin de las 'puertas frías'. Cómo la tecnología está cambiando la prospección de clientes locales (restaurantes, clínicas, etc.).",
            "Ángulo B: Cómo llenar tu WhatsApp de clientes B2B calificados en 3 clics usando bases de datos inteligentes.",
            "Ángulo C: El error que cometen las agencias de marketing al buscar clientes y cómo automatizar la búsqueda geográfica.",
            "Ángulo D: Reseña de Herramienta: Por qué esta nueva plataforma B2B con CRM visual integrado está revolucionando las ventas en Latam."
        ];
        
        const selectedAngle = angles[Math.floor(Math.random() * angles.length)];
        
        const prompt = `Eres un periodista experto en tecnología y marketing digital, redactor principal de "LatinoTech IA".
Tu objetivo es redactar un artículo periodístico, SEO-optimizado, atractivo y altamente persuasivo en español sobre la herramienta "LeadZone".

CONTEXTO DE LA HERRAMIENTA:
- LeadZone es un "radar de ventas B2B" y software de prospección inteligente.
- Permite encontrar clientes calificados filtrando por País, Estado, Ciudad y Nicho.
- Extrae el número de WhatsApp público para contacto directo e inmediato.
- Cuenta con un CRM visual integrado ("Dashboard de Prospección") para guardar leads.

INSTRUCCIONES ESTRICTAS:
1. Enlace Obligatorio: DEBES usar exactamente este formato Markdown para crear un enlace clickeable: [LeadZone](https://leadzone.cloud)
2. Frecuencia de Mención: Integra [LeadZone](https://leadzone.cloud) entre 3 y 4 veces a lo largo del texto.
3. Imágenes: Te proporcionaré 2 URLs de imágenes. Debes incluirlas en el cuerpo del texto usando Markdown (![alt text](url)).
   - Imagen 1 (Características): https://media.base44.com/images/public/69d702ed2c26374e7b4b2c16/94a6ae648_image.png
   - Imagen 2 (Dashboard): https://media.base44.com/images/public/69d702ed2c26374e7b4b2c16/99de3c20c_image.png
4. Llamado a la Acción (CTA): Termina SIEMPRE con un subtítulo de conclusión y una invitación directa a "Crear una cuenta GRATIS" en la plataforma (mencionando que no requiere tarjeta).

ÁNGULO DEL ARTÍCULO A DESARROLLAR ESTA VEZ:
${selectedAngle}

ESTRUCTURA DEL ARTÍCULO:
- Título (H1): Atractivo, con gancho SEO y enfocado en el beneficio principal.
- Introducción: Presenta el dolor/problema real.
- Desarrollo (H2/H3): Explica la solución basándote en el Ángulo elegido e incluye las imágenes de forma natural.
- Conclusión y CTA (H2): Resume el beneficio principal y ejecuta el llamado a la acción.

Devuelve EXCLUSIVAMENTE un JSON con:
- title: Título del artículo
- summary: Resumen de 2 líneas
- content: El artículo completo en Markdown
- seo_keywords: 5 a 7 palabras clave separadas por coma
`;

        const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    title: { type: "string" },
                    summary: { type: "string" },
                    content: { type: "string" },
                    seo_keywords: { type: "string" }
                }
            }
        });
        
        let baseSlug = generateSlug(llmResponse.title);
        let articleSlug = baseSlug;
        let slugCounter = 2;
        
        while ((await base44.asServiceRole.entities.NewsArticle.filter({ slug: articleSlug })).length > 0) {
            articleSlug = `${baseSlug}-${slugCounter}`;
            slugCounter++;
        }

        const coverImage = "https://media.base44.com/images/public/69d702ed2c26374e7b4b2c16/7c482407f_image.png";

        const createdArticle = await base44.asServiceRole.entities.NewsArticle.create({
            slug: articleSlug,
            title: llmResponse.title,
            summary: llmResponse.summary,
            content: llmResponse.content,
            image_url: coverImage,
            category: "Software",
            status: "pending", 
            seo_keywords: llmResponse.seo_keywords,
            source_name: "LatinoTech IA Originals",
            published_date: new Date().toISOString()
        });

        return Response.json({ success: true, articleId: createdArticle.id, angle: selectedAngle });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});