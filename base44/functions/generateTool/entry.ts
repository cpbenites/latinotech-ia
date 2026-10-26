import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const BASE_URL = 'https://latinotechia.com';
const STATIC_SLUGS = ['ai-cost', 'debt-payoff', 'automation-roi'];

const TOOL_SCHEMA = {
    type: 'object',
    properties: {
        slug: { type: 'string', description: 'kebab-case, sem acentos, com palavra-chave' },
        title_pt: { type: 'string' },
        title_es: { type: 'string' },
        title_en: { type: 'string' },
        subtitle_pt: { type: 'string' },
        subtitle_es: { type: 'string' },
        subtitle_en: { type: 'string' },
        about_pt: { type: 'string' },
        about_es: { type: 'string' },
        about_en: { type: 'string' },
        fields: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    key: { type: 'string' },
                    label_pt: { type: 'string' },
                    label_es: { type: 'string' },
                    label_en: { type: 'string' },
                    default: { type: 'string' },
                    currency: { type: 'boolean' },
                    suffix: { type: 'string' },
                    hint_pt: { type: 'string' },
                    hint_es: { type: 'string' },
                    hint_en: { type: 'string' },
                },
                required: ['key', 'label_pt', 'label_es', 'label_en', 'default'],
            },
        },
        outputs: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    key: { type: 'string' },
                    label_pt: { type: 'string' },
                    label_es: { type: 'string' },
                    label_en: { type: 'string' },
                    expr: { type: 'string' },
                    format: { type: 'string', enum: ['money', 'number', 'percent'] },
                    accent: { type: 'boolean' },
                },
                required: ['key', 'label_pt', 'label_es', 'label_en', 'expr', 'format'],
            },
        },
    },
    required: [
        'slug',
        'title_pt',
        'title_es',
        'title_en',
        'subtitle_pt',
        'subtitle_es',
        'subtitle_en',
        'about_pt',
        'about_es',
        'about_en',
        'fields',
        'outputs',
    ],
};

function slugify(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

// Garante que a expressão só usa as variáveis dos campos e funções permitidas.
function sanitizeExpr(expr, keys) {
    const source = String(expr || '');
    if (!source || source.length > 200) return null;

    const withoutFuncs = source.replace(/[a-zA-Z_][a-zA-Z0-9_]*\s*\(/g, '(');
    const ids = withoutFuncs.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    if (ids.some((id) => !keys.includes(id))) return null;

    return source;
}

async function researchDemand(queries) {
    const apiKey = Deno.env.get('EXA_API_KEY');
    if (!apiKey) return '';

    const settled = await Promise.allSettled(
        queries.map(async (query) => {
            const res = await fetch('https://api.exa.ai/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
                body: JSON.stringify({
                    query,
                    numResults: 4,
                    type: 'auto',
                    contents: { text: { maxCharacters: 600 } },
                }),
                signal: AbortSignal.timeout(15000),
            });
            if (!res.ok) return [];
            const data = await res.json();
            return data.results || [];
        })
    );

    const lines = [];
    for (const item of settled) {
        if (item.status !== 'fulfilled' || !item.value) continue;
        for (const result of item.value) {
            if (!result.title) continue;
            const text = (result.text || '').replace(/\s+/g, ' ').slice(0, 200);
            lines.push(`- ${result.title}: ${text}`);
        }
    }

    return lines.slice(0, 16).join('\n');
}

export default async function (req) {
    try {
        const base44 = createClientFromRequest(req);

        const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

        const existing = await base44.asServiceRole.entities.GeneratedTool.list('-created_date', 200);
        const taken = [...STATIC_SLUGS, ...existing.map((t) => t.slug).filter(Boolean)];

        const research = await researchDemand([
            'calculadora online mais buscada no Google 2026',
            'high search volume online calculator tools 2026',
            'calculadora de custo de IA e automação mais procurada',
        ]);

        const prompt = `Você é o editor de produto do LatinoTech IA (latinotechia.com), site de notícias de tecnologia e IA focado em tráfego orgânico.

TAREFA: criar UM novo utilitário interativo (calculadora ou simulador) para atrair tráfego do Google, publicado em português, espanhol e inglês.

COMO O UTILITÁRIO FUNCIONA
- O visitante preenche de 3 a 6 campos numéricos.
- O site aplica fórmulas aritméticas sobre esses campos e mostra de 3 a 6 resultados.
- O motor aceita apenas: números, + - * / ( ) e as funções min, max, abs, round, floor, ceil.
- Cada expressão usa os "key" dos campos como variáveis. Exemplo: se um campo tem key "renda", você pode escrever renda * 0.3.
- Proibido texto livre, listas ou resultados que dependam de conhecimento externo: apenas contas.

COMO ESCOLHER O TEMA
- Priorize o que as pessoas realmente pesquisam: consultas do tipo "calculadora de ...", "quanto custa ...", "simulador de ...".
- Fique no universo do site: inteligência artificial, tecnologia, SaaS, automação, produtividade, finanças pessoais e negócios.
- Não repita nem faça variação destes utilitários já existentes: ${taken.join(', ')}.
- Prefira uma dor concreta que termine num número útil para decidir algo.

QUALIDADE
- Os valores padrão (default) devem ser realistas e gerar um resultado plausível de imediato.
- Use "currency": true em campos de dinheiro e "suffix": "%" em campos de percentual.
- "format" deve ser "money" para dinheiro, "percent" para percentuais e "number" para quantidades.
- Use "accent": true no resultado mais importante, no máximo em dois.
- O título tem de 4 a 8 palavras e deve conter a palavra-chave principal.
- O "subtitle" é uma frase de até 160 caracteres. O "about" tem 2 a 3 frases explicando o cálculo e o que ele não considera.
- Traduza de verdade: cada texto nos três idiomas, sem deixar nada em português no espanhol ou no inglês.
- O slug em kebab-case, curto, com a palavra-chave, sem acentos (ex: calculadora-custo-agentes-ia).

${research ? `PESQUISA DE DEMANDA ATUAL NA WEB (inspiração, não copie títulos):\n${research}` : ''}`;

        const spec = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt,
            model: 'claude-sonnet-5',
            response_json_schema: TOOL_SCHEMA,
        });

        const baseSlug = slugify(spec.slug || spec.title_pt || 'utilitario-ia') || 'utilitario-ia';
        let slug = baseSlug;
        let counter = 2;
        while (taken.includes(slug)) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        const fields = [];
        for (const field of Array.isArray(spec.fields) ? spec.fields : []) {
            if (!field || typeof field.key !== 'string') continue;
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.key)) continue;
            if (fields.some((f) => f.key === field.key)) continue;

            fields.push({
                key: field.key,
                label_pt: field.label_pt || field.key,
                label_es: field.label_es || field.label_pt || field.key,
                label_en: field.label_en || field.label_pt || field.key,
                default: String(field.default ?? ''),
                currency: !!field.currency,
                suffix: field.suffix || '',
                hint_pt: field.hint_pt || '',
                hint_es: field.hint_es || '',
                hint_en: field.hint_en || '',
            });

            if (fields.length >= 6) break;
        }

        const keys = fields.map((f) => f.key);
        const outputs = [];

        for (const output of Array.isArray(spec.outputs) ? spec.outputs : []) {
            if (!output || typeof output.expr !== 'string') continue;
            const expr = sanitizeExpr(output.expr, keys);
            if (!expr) continue;

            outputs.push({
                key: output.key || `out_${outputs.length + 1}`,
                label_pt: output.label_pt || '',
                label_es: output.label_es || output.label_pt || '',
                label_en: output.label_en || output.label_pt || '',
                expr,
                format: ['money', 'number', 'percent'].includes(output.format) ? output.format : 'number',
                accent: !!output.accent,
            });

            if (outputs.length >= 8) break;
        }

        if (fields.length < 1 || outputs.length < 1) {
            return Response.json({ error: 'A IA não devolveu um utilitário válido.' }, { status: 502 });
        }

        const record = await base44.asServiceRole.entities.GeneratedTool.create({
            slug,
            title_pt: spec.title_pt,
            title_es: spec.title_es || spec.title_pt,
            title_en: spec.title_en || spec.title_pt,
            subtitle_pt: spec.subtitle_pt || '',
            subtitle_es: spec.subtitle_es || spec.subtitle_pt || '',
            subtitle_en: spec.subtitle_en || spec.subtitle_pt || '',
            about_pt: spec.about_pt || '',
            about_es: spec.about_es || spec.about_pt || '',
            about_en: spec.about_en || spec.about_pt || '',
            fields,
            outputs,
            search_context: research.slice(0, 2000),
            status: 'published',
            published_date: new Date().toISOString(),
        });

        return Response.json({
            ok: true,
            slug,
            title: spec.title_pt,
            url: `${BASE_URL}/tools/${slug}`,
            fields: fields.length,
            outputs: outputs.length,
            record_id: record.id,
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}