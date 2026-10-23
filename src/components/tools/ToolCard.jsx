import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { toolPath } from '@/lib/tools/config';
import { T } from '@/lib/tools/i18n';

export default function ToolCard({ lang, tool, compact = false }) {
    const copy = T[lang].tools[tool.key];
    const Icon = tool.icon;

    return (
        <Link
            to={toolPath(lang, tool.slug)}
            className="group block bg-white border border-slate-200 p-5 hover:border-green-600 hover:shadow-md transition-all"
        >
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-50 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-green-600" />
                </div>
                <div className="min-w-0">
                    <h3 className="font-black text-slate-900 leading-tight group-hover:text-green-600 transition-colors">
                        {copy.title}
                    </h3>
                    {!compact && (
                        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{copy.subtitle}</p>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 mt-3">
                        {T[lang].hub.open}
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                </div>
            </div>
        </Link>
    );
}