// Helpers editoriais compartilhados entre as funções de geração de conteúdo.
// Módulo simples: apenas exports, sem handler.

export function generateSlug(text) {
    return text.toString().toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 -]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "");
}

export async function fetchWithTimeout(fetchFn, timeoutMs, fallback = "") {
    try {
        return await Promise.race([
            fetchFn(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs))
        ]);
    } catch {
        return fallback;
    }
}

export function extractTag(tag, text) {
    const m = text.match(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`));
    if (!m) return '';
    return m[0].replace(`<${tag}>`, '').replace(`</${tag}>`, '').trim();
}

export function buildTranslatePrompt(langName, article) {
    return `Traduza do Português para ${langName}. Mantenha toda a formatação Markdown. NÃO resuma. Categoria deve ser uma de: IA, Gadgets, Software, Startups, Gaming, Tech, Tutoriales.

TÍTULO: ${article.title}
RESUMO: ${article.summary}
CATEGORIA: ${article.category}
PALAVRAS-CHAVE: ${article.seo_keywords}

CONTEÚDO:
${article.content}

FORMATO — retorne EXATAMENTE este XML:
<article>
<title>TÍTULO TRADUZIDO</title>
<summary>RESUMO TRADUZIDO</summary>
<category>${article.category}</category>
<seo_keywords>KWS TRADUZIDAS</seo_keywords>
<content>
CONTEÚDO MARKDOWN TRADUZIDO
</content>
</article>`;
}