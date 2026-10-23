import { Calculator, TrendingDown, Workflow } from 'lucide-react';

// Cada ferramenta tem um slug neutro, igual nos três idiomas, para que a troca
// de idioma do cabeçalho funcione sem quebrar o caminho.
export const TOOLS = [
    { key: 'aiCost', slug: 'ai-cost', icon: Calculator },
    { key: 'debtPayoff', slug: 'debt-payoff', icon: TrendingDown },
    { key: 'automationRoi', slug: 'automation-roi', icon: Workflow },
];

export const CURRENCY = { pt: 'R$', es: 'US$', en: 'US$' };

export const langPrefix = (lang) => (lang === 'pt' ? '/br' : lang === 'en' ? '/en' : '');

export const hubPath = (lang) => `${langPrefix(lang)}/tools`;

export const toolPath = (lang, slug) => `${langPrefix(lang)}/tools/${slug}`;