import { Sparkles } from 'lucide-react';

export function pickLang(item, base, lang) {
    return item[`${base}_${lang}`] || item[`${base}_pt`] || item[`${base}_es`] || '';
}

export function generatedCopy(lang, record) {
    const title = pickLang(record, 'title', lang);
    return {
        title,
        subtitle: pickLang(record, 'subtitle', lang),
        about: pickLang(record, 'about', lang),
        short: title,
    };
}

export function generatedCard(lang, record) {
    return {
        key: `gen-${record.slug}`,
        slug: record.slug,
        icon: Sparkles,
        copy: generatedCopy(lang, record),
    };
}