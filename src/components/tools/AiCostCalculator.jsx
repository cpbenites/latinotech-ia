import { useMemo, useState } from 'react';
import NumberField from './NumberField';
import Stat from './Stat';
import { T } from '@/lib/tools/i18n';
import { num, formatMoney, formatNumber } from '@/lib/tools/format';

// Preços de referência em dólar, por 1 milhão de tokens. São editáveis.
const MODEL_PRESETS = [
    { id: 'gpt5mini', label: 'GPT-5 mini', input: 0.25, output: 2 },
    { id: 'gpt54', label: 'GPT-5.4', input: 1.25, output: 10 },
    { id: 'gemini3flash', label: 'Gemini 3 Flash', input: 0.3, output: 2.5 },
    { id: 'gemini31pro', label: 'Gemini 3.1 Pro', input: 1.25, output: 10 },
    { id: 'sonnet5', label: 'Claude Sonnet 5', input: 3, output: 15 },
    { id: 'opus5', label: 'Claude Opus 5', input: 15, output: 75 },
    { id: 'custom', label: null, input: null, output: null },
];

export default function AiCostCalculator({ lang }) {
    const t = T[lang].tools.aiCost;

    const [presetId, setPresetId] = useState('gpt5mini');
    const [inputTokens, setInputTokens] = useState('1500');
    const [outputTokens, setOutputTokens] = useState('600');
    const [requestsPerDay, setRequestsPerDay] = useState('500');
    const [daysPerMonth, setDaysPerMonth] = useState('30');
    const [inputPrice, setInputPrice] = useState('0.25');
    const [outputPrice, setOutputPrice] = useState('2');

    const handlePreset = (id) => {
        setPresetId(id);
        const p = MODEL_PRESETS.find((x) => x.id === id);
        if (p && p.input !== null) {
            setInputPrice(String(p.input));
            setOutputPrice(String(p.output));
        }
    };

    const r = useMemo(() => {
        const inT = num(inputTokens);
        const outT = num(outputTokens);
        const rpd = num(requestsPerDay);
        const dpm = num(daysPerMonth);
        const inCost = (inT / 1e6) * num(inputPrice);
        const outCost = (outT / 1e6) * num(outputPrice);
        const perRequest = inCost + outCost;
        const perDay = perRequest * rpd;
        const perMonth = perDay * dpm;
        const total = perRequest || 1;
        return {
            perRequest,
            perDay,
            perMonth,
            perYear: perMonth * 12,
            per1000: perRequest * 1000,
            monthlyTokens: (inT + outT) * rpd * dpm,
            inputShare: (inCost / total) * 100,
            outputShare: (outCost / total) * 100,
        };
    }, [inputTokens, outputTokens, requestsPerDay, daysPerMonth, inputPrice, outputPrice]);

    return (
        <div>
            <div className="bg-white border border-slate-200 p-6">
                <div className="mb-6">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                        {t.presets}
                    </label>
                    <select
                        value={presetId}
                        onChange={(e) => handlePreset(e.target.value)}
                        className="w-full h-10 border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 focus:outline-none focus:border-green-600"
                    >
                        {MODEL_PRESETS.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.label || t.custom}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                    <NumberField label={t.inputTokens} value={inputTokens} onChange={setInputTokens} />
                    <NumberField label={t.outputTokens} value={outputTokens} onChange={setOutputTokens} />
                    <NumberField label={t.requestsPerDay} value={requestsPerDay} onChange={setRequestsPerDay} />
                    <NumberField label={t.daysPerMonth} value={daysPerMonth} onChange={setDaysPerMonth} />
                    <NumberField
                        label={t.inputPrice}
                        value={inputPrice}
                        onChange={setInputPrice}
                        prefix="US$"
                        hint={t.priceHint}
                    />
                    <NumberField label={t.outputPrice} value={outputPrice} onChange={setOutputPrice} prefix="US$" />
                </div>
            </div>

            <div className="mt-8 bg-slate-50 border border-slate-200 p-6">
                <h2 className="text-lg font-black text-slate-900 mb-5">{t.results}</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Stat label={t.perRequest} value={formatMoney(r.perRequest, lang, 'US$')} accent />
                    <Stat label={t.per1000} value={formatMoney(r.per1000, lang, 'US$')} />
                    <Stat label={t.perDay} value={formatMoney(r.perDay, lang, 'US$')} />
                    <Stat label={t.perMonth} value={formatMoney(r.perMonth, lang, 'US$')} accent />
                    <Stat label={t.perYear} value={formatMoney(r.perYear, lang, 'US$')} />
                    <Stat label={t.monthlyTokens} value={formatNumber(r.monthlyTokens, lang)} />
                </div>

                <div className="mt-6">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{t.split}</p>
                    <div className="flex h-3 w-full overflow-hidden bg-slate-200">
                        <div className="bg-green-600" style={{ width: `${r.inputShare}%` }} />
                        <div className="bg-slate-400" style={{ width: `${r.outputShare}%` }} />
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-slate-500 mt-2">
                        <span>
                            {t.input}: {formatNumber(r.inputShare, lang)}%
                        </span>
                        <span>
                            {t.output}: {formatNumber(r.outputShare, lang)}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}