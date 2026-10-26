import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const BASE_URL = 'https://latinotechia.com';
const STATIC_SLUGS = ['ai-cost', 'debt-payoff', 'automation-roi'];

const TEXT_ITEM = {
    type: 'object',
    properties: {
        key: { type: 'string' },
        label_pt: { type: 'string' },
        label_es: { type: 'string' },
        label_en: { type: 'string' },
        default: { type: 'string' },
    },
    required: ['key', 'label_pt', 'label_es', 'label_en'],
};

const TOOL_SCHEMA = {
    type: 'object',
    properties: {
        kind: { type: 'string', enum: ['calculator', 'generator'] },
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
            description: 'Somente para calculadora',
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
            description: 'Somente para calculadora',
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
        generator: {
            type: 'object',
            description: 'Somente para gerador',
            properties: {
                type: { type: 'string', enum: ['password', 'numbers', 'template'] },
                length: { type: 'number' },
                lowercase: { type: 'boolean' },
                uppercase: { type: 'boolean' },
                digits: { type: 'boolean' },
                symbols: { type: 'boolean' },
                count: { type: 'number' },
                min: { type: 'number' },
                max: { type: 'number' },
                unique: { type: 'boolean' },
                sort: { type: 'boolean' },
                template: { type: 'string' },
                pools: {
                    type: 'object',
                    additionalProperties: { type: 'array', items: { type: 'string' } },
                },
                fields: { type: 'array', items: TEXT_ITEM },
            },
            required: ['type'],
        },
    },
    required: [
        'kind',
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
    ],
};

function clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.min(max, Math.max(min, number));
}

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

function buildGenerator(raw) {
    const source = raw || {};
    const type = ['password', 'numbers', 'template'].includes(source.type) ? source.type : null;
    if (!type) return null;

    if (type === 'password') {
        const generator = {
            type,
            length: clamp(source.length || 16, 8, 32),
            lowercase: source.lowercase !== false,
            uppercase: !!source.uppercase,
            digits: !!source.digits,
            symbols: !!source.symbols,
        };
        if (!generator.uppercase && !generator.digits && !generator.symbols) generator.lowercase = true;
        return generator;
    }

    if (type === 'numbers') {
        const min = Number.isFinite(Number(source.min)) ? Number(source.min) : 1;
        const max = Number.isFinite(Number(source.max)) ? Number(source.max) : 60;
        return {
            type,
            count: clamp(source.count || 6, 1, 100),
            min: Math.min(min, max),
            max: Math.max(min, max),
            unique: source.unique !== false,
            sort: source.sort !== false,
        };
    }

    const template = String(source.template || '').trim();
    if (!template) return null;

    const pools = {};
    for (const [key, list] of Object.entries(source.pools || {})) {
        if (!Array.isArray(list)) continue;
        const items = list
            .filter((value) => typeof value === 'string' && value.trim())
            .map((value) => value.trim())
            .slice(0, 60);
        if (items.length) pools[key] = items;
    }

    const fields = [];
    for (const field of Array.isArray(source.fields) ? source.fields : []) {
        if (!field || typeof field.key !== 'string') continue;
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.key)) continue;
        if (fields.some((item) => item.key === field.key)) continue;

        fields.push({
            key: field.key,
            label_pt: field.label_pt || field.key,
            label_es: field.label_es || field.label_pt || field.key,
            label_en: field.label_en || field.label_pt || field.key,
            default: String(field.default ?? ''),
        });

        if (fields.length >= 4) break;
    }

    if (!Object.keys(pools).length && !fields.length) return null;

    return { type, template: template.slice(0, 300), count: clamp(source.count || 5, 1, 10), pools, fields };
}

function buildCalculatorFields(raw) {
    const fields = [];
    for (const field of Array.isArray(raw) ? raw : []) {
        if (!field || typeof field.key !== 'string') continue;
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.key)) continue;
        if (fields.some((item) => item.key === field.key)) continue;

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
    return fields;
}

export default async function (req) {
    try {
        const base44 = createClientFromRequest(req);

        const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

        const existing = await base44.asServiceRole.entities.GeneratedTool.list('-created_date', 200);
        const taken = [...STATIC_SLUGS, ...existing.map((t) => t.slug).filter(Boolean)];
        const recent = existing
            .slice(0, 8)
            .map((t) => `${t.slug} (${t.kind === 'generator' ? 'gerador' : 'calculadora'})`)
            .join(', ');

        const research = await researchDemand([
            'gerador online mais buscado no Google 2026',
            'calculadora online mais buscada no Google 2026',
            'high search volume online generator tools 2026',
        ]);

        const prompt = `Você é o editor de produto do LatinoTech IA (latinotechia.com), site de notícias de tecnologia e IA focado em tráfego orgânico.

TAREFA: criar UM novo utilitário online para atrair tráfego do Google, publicado em português, espanhol e inglês. Pode ser uma calculadora (o visitante digita números e recebe contas) ou um gerador (o visitante clica e recebe algo pronto).

FORMATO 1 — kind "calculator"
- O visitante preenche de 3 a 6 campos numéricos.
- O site aplica fórmulas sobre esses campos e mostra de 3 a 6 resultados.
- O motor aceita apenas: números, + - * / ( ) e as funções min, max, abs, round, floor, ceil.
- Cada expressão usa os "key" dos campos como variáveis. Ex.: com o campo "renda", escreva renda * 0.3.
- Proibido texto livre, listas ou resultados que dependam de conhecimento externo.
- Serve para: "calculadora de ...", "quanto custa ...", "simulador de ...".

FORMATO 2 — kind "generator"
O visitante recebe o resultado em um clique. Três mecânicas disponíveis:
a) type "password": gera senhas aleatórias. Informe length (8 a 32) e quais conjuntos usar: lowercase, uppercase, digits, symbols.
b) type "numbers": sorteia números. Informe count (quantos), min, max, unique (sem repetir) e sort (em ordem). Serve para bingo, sorteio, loteria, rifa, numeração.
c) type "template": monta textos combinando listas de palavras. Você define:
   - template: texto com marcadores {chave} para as listas e {#min-max} para números aleatórios. Ex.: "{nome}.{sobrenome}{#1-99}@{dominio}"
   - pools: listas de palavras por marcador, com 12 a 30 itens variados e realistas. Ex.: { "nome": ["Ana","Bruno"], "dominio": ["gmail.com","outlook.com"] }
   - fields: até 4 campos de texto que o visitante preenche, quando o gerador precisa de um dado dele (ex.: DDD, telefone, nome do autor, título do trabalho).
   - count: quantos resultados mostrar (1 a 10).
   Serve para: gerador de nomes, apelido, e-mail, link do WhatsApp, referência bibliográfica, sorteio de palavras.

COMO ESCOLHER O TEMA
- Priorize o que as pessoas realmente digitam no Google: "gerador de ...", "calculadora de ...", "quanto custa ...", "simulador de ...", "sortear ...".
- Dois universos são bem-vindos:
  a) tecnologia, IA, SaaS, automação, produtividade, finanças e negócios;
  b) utilidades digitais do dia a dia com busca alta: senhas, nomes, números, sorteios, e-mails, apelidos, links.
- Não repita nem faça variação destes utilitários já existentes: ${taken.join(', ')}.
- Varie o formato entre execuções. Últimos gerados: ${recent || 'nenhum ainda'}.
- Prefira um tema com dor concreta e um resultado imediato e útil.

O QUE NÃO É POSSÍVEL (não proponha)
- Nada que exija biblioteca externa ou dado oficial: QR code, código de barras, CPF, CNPJ, PIS, imagens e vídeos.

QUALIDADE
- Os valores padrão devem ser realistas e gerar resultado plausível de imediato.
- Calculadora: "currency": true em campos de dinheiro, "suffix": "%" em percentual, "format" = money|percent|number, "accent": true no resultado principal (máx. 2).
- Título com 4 a 8 palavras contendo a palavra-chave principal.
- "subtitle": uma frase de até 160 caracteres. "about": 2 a 3 frases explicando o que a ferramenta faz e o que ela não considera.
- Traduza de verdade: cada texto nos três idiomas, sem sobras de português no espanhol ou no inglês.
- O slug em kebab-case, curto, com a palavra-chave, sem acentos (ex: gerador-de-senha-segura).

${research ? `PESQUISA DE DEMANDA ATUAL NA WEB (inspiração, não copie títulos):\n${research}` : ''}`;

        const spec = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt,
            model: 'claude-sonnet-5',
            response_json_schema: TOOL_SCHEMA,
        });

        const kind = spec.kind === 'generator' ? 'generator' : 'calculator';
        let generator = null;
        let fields = [];
        let outputs = [];

        if (kind === 'generator') {
            generator = buildGenerator(spec.generator);
            if (!generator) {
                return Response.json({ error: 'A IA não devolveu um gerador válido.' }, { status: 502 });
            }
        } else {
            fields = buildCalculatorFields(spec.fields);
            const keys = fields.map((f) => f.key);

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
                return Response.json({ error: 'A IA não devolveu calculadora válida.' }, { status: 502 });
            }
        }

        const baseSlug = slugify(spec.slug || spec.title_pt || 'utilitario-ia') || 'utilitario-ia';
        let slug = baseSlug;
        let counter = 2;
        while (taken.includes(slug)) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        const record = await base44.asServiceRole.entities.GeneratedTool.create({
            slug,
            kind,
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
            generator,
            search_context: research.slice(0, 2000),
            status: 'published',
            published_date: new Date().toISOString(),
        });

        return Response.json({
            ok: true,
            kind,
            slug,
            title: spec.title_pt,
            url: `${BASE_URL}/tools/${slug}`,
            fields: fields.length,
            outputs: outputs.length,
            generator: generator ? generator.type : null,
            record_id: record.id,
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}