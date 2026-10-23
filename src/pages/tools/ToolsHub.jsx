import { useEffect } from 'react';
import { TOOLS } from '@/lib/tools/config';
import { T } from '@/lib/tools/i18n';
import ToolCard from '@/components/tools/ToolCard';

export default function ToolsHub({ lang }) {
    const t = T[lang];

    useEffect(() => {
        document.title = `${t.hub.title} | LatinoTech IA`;
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute('content', t.hub.subtitle);
    }, [t]);

    return (
        <div className="container mx-auto px-4 py-10 max-w-5xl">
            <header className="mb-10 max-w-2xl">
                <span className="inline-block bg-green-50 text-green-700 text-xs font-black uppercase tracking-wide px-3 py-1 mb-4">
                    {t.hub.badge}
                </span>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 mb-4">{t.hub.title}</h1>
                <p className="text-slate-600 text-lg leading-relaxed">{t.hub.subtitle}</p>
            </header>

            <div className="grid md:grid-cols-2 gap-5">
                {TOOLS.map((tool) => (
                    <ToolCard key={tool.key} lang={lang} tool={tool} />
                ))}
            </div>

            <p className="mt-10 text-xs text-slate-400">{t.hub.privacyNote}</p>
        </div>
    );
}