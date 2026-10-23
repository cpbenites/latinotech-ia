import { Input } from '@/components/ui/input';

export default function NumberField({ label, value, onChange, prefix, suffix, hint, step = 'any', min = '0' }) {
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
            <div className="relative">
                {prefix && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold pointer-events-none">
                        {prefix}
                    </span>
                )}
                <Input
                    type="number"
                    inputMode="decimal"
                    step={step}
                    min={min}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`font-semibold ${prefix ? 'pl-14' : ''} ${suffix ? 'pr-14' : ''}`}
                />
                {suffix && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold pointer-events-none">
                        {suffix}
                    </span>
                )}
            </div>
            {hint && <p className="text-xs text-slate-400 leading-snug">{hint}</p>}
        </div>
    );
}