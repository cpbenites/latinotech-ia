// Converte o valor cru de um campo de texto em número seguro.
export const num = (v) => {
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
};

const locale = (lang) => (lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : 'es-CO');

export function formatMoney(value, lang, currency) {
    const symbol = currency || 'US$';
    const abs = Math.abs(value);
    const decimals = abs > 0 && abs < 1 ? 4 : 2;
    return `${symbol} ${value.toLocaleString(locale(lang), {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })}`;
}

export function formatNumber(value, lang, decimals = 0) {
    return value.toLocaleString(locale(lang), {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

export function formatDate(date, lang) {
    return date.toLocaleDateString(locale(lang), { month: 'long', year: 'numeric' });
}