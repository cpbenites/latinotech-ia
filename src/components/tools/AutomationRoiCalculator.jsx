import { useMemo, useState } from 'react';
import NumberField from './NumberField';
import Stat from './Stat';
import { T } from '@/lib/tools/i18n';
import { CURRENCY } from '@/lib/tools/config';
import { num, formatMoney, formatNumber } from '@/lib/tools/format';

const WEEKS_PER_MONTH = 4.33;

export default function AutomationRoiCalculator({ lang }) {
    const t = T[lang].tools.automationRoi;
    const cur = CURRENCY[lang];

    const [people, setPeople] = useState('2');
    const [hoursPerWeek, setHoursPerWeek] = useState('6');
    const [hourlyCost, setHourlyCost] = useState('45');
    const [pct, setPct] = useState('70');
    const [toolCost, setToolCost] = useState('250');
    const [setupCost, setSetupCost] = useState('1500');

    const r = useMemo(() => {
        const p = num(people);
        const hpw = num(hoursPerWeek);
        const hourly = num(hourlyCost);
        const percent = num(pct);
        const tool = num(toolCost);
        const setup = num(setupCost);

        const hoursSaved = p * hpw * (percent / 100) * WEEKS_PER_MONTH;
        const savingsMonth = hoursSaved * hourly;
        const netMonth = savingsMonth - tool;
        const investYear = setup + tool * 12;
        const yearNet = savingsMonth * 12 - investYear;
        const payback = netMonth > 0 ? setup / netMonth : Infinity;
        const roi = investYear > 0 ? (yearNet / investYear) * 100 : 0;

        return { hoursSaved, savingsMonth, netMonth, yearNet, payback, roi, setup, investYear };
    }, [people, hoursPerWeek, hourlyCost, pct, toolCost, setupCost]);

    const paybackValue =
        r.setup === 0
            ? t.paybackImmediate
            : !Number.isFinite(r.payback)
              ? t.paybackNever
              : `${formatNumber(r.payback, lang, 1)} ${t.paybackUnit}`;

    return (
        <div>
            <div className="bg-white border border-slate-200 p-6">
                <div className="grid sm:grid-cols-2 gap-5">
                    <NumberField label={t.people} value={people} onChange={setPeople} />
                    <NumberField label={t.hoursPerWeek} value={hoursPerWeek} onChange={setHoursPerWeek} />
                    <NumberField label={t.hourlyCost} value={hourlyCost} onChange={setHourlyCost} prefix={cur} />
                    <NumberField label={t.toolCost} value={toolCost} onChange={setToolCost} prefix={cur} />
                    <NumberField label={t.setupCost} value={setupCost} onChange={setSetupCost} prefix={cur} />

                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                            {t.automationPct}{' '}
                            <span className="text-green-600 font-black">{pct}%</span>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={pct}
                            onChange={(e) => setPct(e.target.value)}
                            className="w-full h-10 accent-green-600 cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            <div className="mt-8 bg-slate-50 border border-slate-200 p-6">
                <h2 className="text-lg font-black text-slate-900 mb-5">{t.results}</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Stat
                        label={t.hoursSaved}
                        value={`${formatNumber(r.hoursSaved, lang, 1)} h`}
                    />
                    <Stat label={t.savingsMonth} value={formatMoney(r.savingsMonth, lang, cur)} />
                    <Stat label={t.toolMonth} value={formatMoney(num(toolCost), lang, cur)} />
                    <Stat label={t.netMonth} value={formatMoney(r.netMonth, lang, cur)} accent />
                    <Stat label={t.payback} value={paybackValue} />
                    <Stat label={t.roiPct} value={`${formatNumber(r.roi, lang, 0)}%`} accent />
                    <Stat label={t.yearNet} value={formatMoney(r.yearNet, lang, cur)} />
                </div>
            </div>
        </div>
    );
}