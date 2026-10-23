import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { TOOLS, hubPath } from '@/lib/tools/config';
import { T } from '@/lib/tools/i18n';
import ToolCard from './ToolCard';

export default function ToolShell({ lang, tool, children }) {
    const t = T[lang];
    const copy = t.tools[tool.key];
    const others = TOOLS.filter((x) => x.key !== tool.key);

    useEffect(() => {
        document.title = `${copy.title} | LatinoTech IA`;
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute('content', copy.subtitle);
    }, [copy.title, copy.subtitle]);

    return (
        <div className="container mx-auto px-4 py-10 max-w-4xl">
            <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-6">
                <Link to={hubPath(lang)} className="hover:text-green-600 transition-colors">
                    {t.navTools}
                </Link>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-slate-600">{copy.short}</span>
            </nav>

            <header className="mb-8">
                <span className="inline-block bg-green-50 text-green-700 text-xs font-black uppercase tracking-wide px-3 py-1 mb-4">
                    {t.hub.badge}
                </span>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-3">{copy.title}</h1>
                <p className="text-slate-600 text-lg leading-relaxed">{copy.subtitle}</p>
            </header>

            {children}

            <section className="mt-10 border-t border-slate-200 pt-6">
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-900 mb-3">{t.hub.aboutTitle}</h2>
                <p className="text-sm text-slate-500 leading-relaxed">{copy.about}</p>
            </section>

            <section className="mt-10">
                <h2 className="text-lg font-black text-slate-900 mb-4">{t.hub.relatedTitle}</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                    {others.map((o) => (
                        <ToolCard key={o.key} lang={lang} tool={o} compact />
                    ))}
                </div>
            </section>

            <p className="mt-10 text-xs text-slate-400 text-center">{t.hub.privacyNote}</p>
        </div>
    );
}