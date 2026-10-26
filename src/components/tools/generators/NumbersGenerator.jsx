import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import NumberField from '../NumberField';
import { T } from '@/lib/tools/i18n';
import { generateNumbers } from '@/lib/tools/generate';

export default function NumbersGenerator({ lang, spec }) {
    const t = T[lang].hub;
    const [config, setConfig] = useState({
        count: Number(spec.count) || 6,
        min: Number.isFinite(Number(spec.min)) ? Number(spec.min) : 1,
        max: Number.isFinite(Number(spec.max)) ? Number(spec.max) : 60,
    });
    const [result, setResult] = useState(() => generateNumbers(spec));

    const update = (key, value) => {
        const next = { ...config, [key]: Number(value) || 0 };
        setConfig(next);
        setResult(generateNumbers({ ...spec, ...next }));
    };

    return (
        <div>
            <div className="bg-white border border-slate-200 p-6">
                <div className="grid sm:grid-cols-3 gap-5">
                    <NumberField label={t.count} value={String(config.count)} onChange={(v) => update('count', v)} />
                    <NumberField label={t.from} value={String(config.min)} onChange={(v) => update('min', v)} />
                    <NumberField label={t.to} value={String(config.max)} onChange={(v) => update('max', v)} />
                </div>
            </div>

            <div className="mt-8 bg-slate-50 border border-slate-200 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <h2 className="text-lg font-black text-slate-900">{t.results}</h2>
                    <button
                        type="button"
                        onClick={() => setResult(generateNumbers({ ...spec, ...config }))}
                        className="inline-flex items-center gap-2 bg-green-600 text-white text-sm font-bold px-4 py-2 hover:bg-green-700"
                    >
                        <RefreshCw className="w-4 h-4" /> {t.generate}
                    </button>
                </div>
                <div className="flex flex-wrap gap-3">
                    {result.map((number, index) => (
                        <span
                            key={`${number}-${index}`}
                            className="bg-white border border-slate-200 text-slate-900 font-mono text-lg font-bold px-4 py-2 min-w-[64px] text-center"
                        >
                            {number}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}