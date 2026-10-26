import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { T } from '@/lib/tools/i18n';
import { Input } from '@/components/ui/input';
import { generateTemplate } from '@/lib/tools/generate';
import { pickLang } from '@/lib/tools/toolCopy';

export default function TemplateGenerator({ lang, spec }) {
    const t = T[lang].hub;
    const fields = spec.fields || [];
    const [values, setValues] = useState(() =>
        Object.fromEntries(fields.map((field) => [field.key, String(field.default ?? '')]))
    );
    const [result, setResult] = useState(() => generateTemplate(spec, {}));

    const update = (key, value) => {
        const next = { ...values, [key]: value };
        setValues(next);
        setResult(generateTemplate(spec, next));
    };

    return (
        <div>
            {fields.length > 0 && (
                <div className="bg-white border border-slate-200 p-6">
                    <div className="grid sm:grid-cols-2 gap-5">
                        {fields.map((field) => (
                            <div key={field.key}>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    {pickLang(field, 'label', lang)}
                                </label>
                                <Input
                                    value={values[field.key] ?? ''}
                                    onChange={(e) => update(field.key, e.target.value)}
                                    className="rounded-none border-slate-300"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-8 bg-slate-50 border border-slate-200 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <h2 className="text-lg font-black text-slate-900">{t.results}</h2>
                    <button
                        type="button"
                        onClick={() => setResult(generateTemplate(spec, values))}
                        className="inline-flex items-center gap-2 bg-green-600 text-white text-sm font-bold px-4 py-2 hover:bg-green-700"
                    >
                        <RefreshCw className="w-4 h-4" /> {t.generate}
                    </button>
                </div>
                <div className="space-y-2">
                    {result.map((line, index) => (
                        <div
                            key={index}
                            className="bg-white border border-slate-200 px-4 py-3 font-mono text-sm text-slate-800 break-all select-all"
                        >
                            {line}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}