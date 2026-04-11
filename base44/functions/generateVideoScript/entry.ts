import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { title, summary, content } = await req.json();

        if (!title || !content) {
            return Response.json({ error: 'Missing article data' }, { status: 400 });
        }

        const prompt = `Actúa como un experto creador de contenido viral para TikTok, Reels y Shorts.
Tu tarea es convertir la siguiente noticia tecnológica en un guion de video corto (máximo 60 segundos de lectura).

Noticia:
Título: ${title}
Resumen: ${summary}
Contenido: ${content}

ESTRUCTURA RIGUROSA QUE DEBES SEGUIR:
- HOOK (Gancho): Una frase altamente impactante o curiosa para los primeros 3 segundos.
- CORPO: 2 a 3 puntos clave de la noticia explicados de forma muy dinámica y simple.
- CTA (Chamada para Ação): Un breve llamado final para que lean la noticia completa en "latinotechia.com".
- Dicas Visuais: Intercala sugerencias simples de edición visual o sonora entre paréntesis (ej: "[Mostrar imagen del robot]", "[Efecto de sonido de transición]").

El tono debe ser energético, moderno, rápido y adaptado para audiencia joven interesada en tecnología.
No incluyas saludos largos, ve directo al grano.
Devuelve únicamente el texto del guion, sin introducciones ni despedidas adicionales.`;

        const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: prompt
        });

        return Response.json({ script: llmResponse });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});