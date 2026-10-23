import { useMemo, useState } from 'react';
import NumberField from './NumberField';
import Stat from './Stat';
import { T } from '@/lib/tools/i18n';
import { CURRENCY } from '@/lib/tools/config';
import { num, formatMoney, formatDate } from '@/lib/tools/format';

// Simula o saldo mês a mês com juros compostos. Retorna null se a dívida nunca é quitada.
function simulate(amount, monthlyRate, pay) {
    const r = monthlyRate / 100;
    let balance = amount;
    let months = 0;
    let totalPaid = 0;

    while (balance > 0.005 && months < 600) {
        const interest = balance * r;
        if (pay <= interest) return null;
        const due = balance + interest;
        const paid = Math.min(pay, due);
        balance = due - paid;
        totalPaid += paid;
        months++;
    }

    if (months >= 600) return null;
    return { months, totalPaid, totalInterest: totalPaid - amount };
}

export default function DebtPayoffSimulator({ lang }) {
    const t = T[lang].tools.debtPayoff;
    const cur = CURRENCY[lang];

    const [debt, setDebt] = useState('5000');
    const [rate, setRate] = useState('3.5');
    const [payment, setPayment] = useState('300');

    const r = useMemo(() => {
        const amount = num(debt);
        const monthlyRate = num(rate);
        const pay = num(payment);
        const base = simulate(amount, monthlyRate, pay);
        const scenarios = [10, 25, 50].map((pct) => {
            const extra = pay * (pct / 100);
            return { pct, extra, sim: simulate(amount, monthlyRate, pay + extra) };
        });
        return { amount, base, scenarios };
    }, [debt, rate, payment]);

    const payoffDate = r.base
        ? new Date(new Date().setMonth(new Date().getMonth() + r.base.months))
        : null;

    return (
        <div>
            <div className="bg-white border border-slate-200 p-6">
                <div className="grid sm:grid-cols-3 gap-5">
                    <NumberField label={t.debt} value={debt} onChange={setDebt} prefix={cur} />
                    <NumberField label={t.rate} value={rate} onChange={setRate} suffix="%" />
                    <NumberField label={t.payment} value={payment} onChange={setPayment} prefix={cur} />
                </div>
            </div>

            <div className="mt-8 bg-slate-50 border border-slate-200 p-6">
                <h2 className="text-lg font-black text-slate-900 mb-5">{t.results}</h2>

                {r.base ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Stat
                            label={t.months}
                            value={`${r.base.months} ${t.monthsUnit}`}
                            accent
                        />
                        <Stat label={t.totalPaid} value={formatMoney(r.base.totalPaid, lang, cur)} />
                        <Stat label={t.totalInterest} value={formatMoney(r.base.totalInterest, lang, cur)} />
                        <Stat label={t.payoffDate} value={payoffDate ? formatDate(payoffDate, lang) : '-'} />
                    </div>
                ) : (
                    <p className="text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 p-4 leading-relaxed">
                        {t.never}
                    </p>
                )}

                <div className="mt-8">
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-900 mb-3">
                        {t.scenariosTitle}
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                    <th className="py-2 pr-4 border-b border-slate-200">&nbsp;</th>
                                    <th className="py-2 pr-4 border-b border-slate-200">{t.scenarioMonths}</th>
                                    <th className="py-2 pr-4 border-b border-slate-200">{t.scenarioInterest}</th>
                                    <th className="py-2 border-b border-slate-200">{t.scenarioSaving}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="py-3 pr-4 border-b border-slate-100 font-bold text-slate-900">
                                        {t.scenarioBase}
                                    </td>
                                    <td className="py-3 pr-4 border-b border-slate-100 font-semibold text-slate-700">
                                        {r.base ? `${r.base.months} ${t.monthsUnit}` : t.scenarioNone}
                                    </td>
                                    <td className="py-3 pr-4 border-b border-slate-100 text-slate-600">
                                        {r.base ? formatMoney(r.base.totalInterest, lang, cur) : '-'}
                                    </td>
                                    <td className="py-3 border-b border-slate-100 text-slate-400">-</td>
                                </tr>
                                {r.scenarios.map((s) => (
                                    <tr key={s.pct}>
                                        <td className="py-3 pr-4 border-b border-slate-100 font-bold text-slate-900">
                                            {t.scenarioExtra.replace('{v}', formatMoney(s.extra, lang, cur))}
                                        </td>
                                        <td className="py-3 pr-4 border-b border-slate-100 font-semibold text-slate-700">
                                            {s.sim ? `${s.sim.months} ${t.monthsUnit}` : t.scenarioNone}
                                        </td>
                                        <td className="py-3 pr-4 border-b border-slate-100 text-slate-600">
                                            {s.sim ? formatMoney(s.sim.totalInterest, lang, cur) : '-'}
                                        </td>
                                        <td className="py-3 border-b border-slate-100 font-bold text-green-600">
                                            {s.sim && r.base
                                                ? formatMoney(r.base.totalInterest - s.sim.totalInterest, lang, cur)
                                                : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}