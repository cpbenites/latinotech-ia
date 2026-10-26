import { useMemo, useState } from 'react';
import NumberField from './NumberField';
import Stat from './Stat';
import { CURRENCY } from '@/lib/tools/config';
import { T } from '@/lib/tools/i18n';
import { evaluate } from '@/lib/tools/expr';
import { num, formatMoney, formatNumber } from '@/lib/tools/format';
import { pickLang } from '@/lib/tools/toolCopy';

export default function GeneratedToolView({ lang, tool }) {
    const t = T[lang];
    const cur = CURRENCY[lang];
    const fields = tool.fields || [];
    const outputs = tool.outputs || [];

    const [values, setValues] = useState(() =>
        Object.fromEntries(fields.map((f) => [f.key, String(f.default ?? '')]))
    );

    const vars = useMemo(() => {
        const v = {};
        for (const f of fields) v[f.key] = num(values[f.key]);
        return v;
    }, [values, fields]);

    const formatOutput = (out) => {
        const v = evaluate(out.expr, vars);
        if (!Number.isFinite(v)) return '—';
        if (out.format === 'money') return formatMoney(v, lang, cur);
        if (out.format === 'percent') return `${formatNumber(v, lang, 1)}%`;
        return formatNumber(v, lang, 2);
    };

    return (
        <div>
            <div className="bg-white border border-slate-200 p-6">
                <div className="grid sm:grid-cols-2 gap-5">
                    {fields.map((f) => (
                        <NumberField
                            key={f.key}
                            label={pickLang(f, 'label', lang)}
                            value={values[f.key] ?? ''}
                            onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                            prefix={f.currency ? cur : undefined}
                            suffix={f.suffix || undefined}
                            hint={pickLang(f, 'hint', lang) || undefined}
                        />
                    ))}
                </div>
            </div>

            <div className="mt-8 bg-slate-50 border border-slate-200 p-6">
                <h2 className="text-lg font-black text-slate-900 mb-5">{t.hub.results}</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {outputs.map((o) => (
                        <Stat
                            key={o.key}
                            label={pickLang(o, 'label', lang)}
                            value={formatOutput(o)}
                            accent={!!o.accent}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}