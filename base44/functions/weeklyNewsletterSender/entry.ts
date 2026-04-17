import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // 1. Buscar os 5 artigos publicados nos últimos 7 dias
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const allPublished = await base44.asServiceRole.entities.NewsArticle.filter(
            { status: 'published', language: 'pt' },
            '-published_date',
            50
        );

        const recentArticles = allPublished
            .filter(a => {
                const date = new Date(a.published_date || a.created_date);
                return date >= sevenDaysAgo;
            })
            .slice(0, 5);

        if (recentArticles.length === 0) {
            return Response.json({ success: false, message: "Nenhum artigo publicado nos últimos 7 dias." });
        }

        // Montar os dados dos artigos para o prompt
        const articlesSummary = recentArticles.map((a, i) => {
            const slug = a.slug || a.id;
            const url = `https://latinotechia.com/br/noticia/${slug}`;
            return `${i + 1}. Título: ${a.title}\n   Resumo: ${a.summary || ''}\n   URL: ${url}`;
        }).join('\n\n');

        // 2. Prompt de copywriting para gerar a newsletter
        const prompt = `Atue como um Especialista em E-mail Marketing e Jornalista de Tecnologia. A sua missão é escrever a newsletter semanal premium do portal LatinoTech IA.

ARTIGOS DA SEMANA:
${articlesSummary}

ESTRUTURA DO E-MAIL:
- Assunto do E-mail: Crie um assunto altamente clicável (Clickbait inteligente) baseado na notícia mais forte da semana.
- Introdução (O Gancho): Um parágrafo pessoal, acolhedor e instigante sobre o avanço da IA nesta semana.
- O Top 5 (O Valor): Apresente as 5 notícias fornecidas. Para cada uma, coloque o Título em negrito, um resumo de 1 ou 2 linhas e um link claro dizendo 'Ler artigo completo →' [INSERIR URL DA NOTÍCIA].
- Ferramenta da Semana (A Venda): Crie uma secção especial no final recomendando a 'ElevenLabs' como a melhor ferramenta de clonagem de voz do mercado. Explique o benefício em 2 frases e use OBRIGATORIAMENTE este link de afiliado no botão/Call to Action: https://try.elevenlabs.io/jr0l9b967jwp

Gere o e-mail completo em TRÊS IDIOMAS: Português, Espanhol e Inglês.

Devolva EXCLUSIVAMENTE um objeto JSON válido com a seguinte estrutura:
{
  "pt": { "subject": "...", "content": "..." },
  "es": { "subject": "...", "content": "..." },
  "en": { "subject": "...", "content": "..." }
}`;

        const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    pt: {
                        type: "object",
                        properties: {
                            subject: { type: "string" },
                            content: { type: "string" }
                        },
                        required: ["subject", "content"]
                    },
                    es: {
                        type: "object",
                        properties: {
                            subject: { type: "string" },
                            content: { type: "string" }
                        },
                        required: ["subject", "content"]
                    },
                    en: {
                        type: "object",
                        properties: {
                            subject: { type: "string" },
                            content: { type: "string" }
                        },
                        required: ["subject", "content"]
                    }
                },
                required: ["pt", "es", "en"]
            }
        });

        // 4. Salvar o draft na base de dados
        const draft = await base44.asServiceRole.entities.NewsletterDraft.create({
            subject_pt: llmResponse.pt.subject,
            content_pt: llmResponse.pt.content,
            subject_es: llmResponse.es.subject,
            content_es: llmResponse.es.content,
            subject_en: llmResponse.en.subject,
            content_en: llmResponse.en.content,
            created_at: new Date().toISOString(),
            status: "draft"
        });

        return Response.json({
            success: true,
            message: `Newsletter draft criado com sucesso! ${recentArticles.length} artigos incluídos.`,
            draft_id: draft.id
        });

    } catch (error) {
        console.error("Erro em weeklyNewsletterSender:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});