import { useState } from 'react';
import { RefreshCw, Copy, Check } from 'lucide-react';
import { T } from '@/lib/tools/i18n';
import { generatePassword } from '@/lib/tools/generate';

const OPTIONS = ['uppercase', 'lowercase', 'digits', 'symbols'];

export default function PasswordGenerator({ lang, spec }) {
    const t = T[lang].hub;
    const [length, setLength] = useState(Number(spec.length) || 16);
    const [options, setOptions] = useState({
        uppercase: !!spec.uppercase,
        lowercase: spec.lowercase !== false,
        digits: !!spec.digits,
        symbols: !!spec.symbols,
    });
    const [password, setPassword] = useState(() => generatePassword(spec));
    const [copied, setCopied] = useState(false);

    const refresh = (nextLength, nextOptions) => {
        setPassword(generatePassword({ ...nextOptions, length: nextLength }));
        setCopied(false);
    };

    const changeLength = (value) => {
        setLength(value);
        refresh(value, options);
    };

    const toggle = (key) => {
        const next = { ...options, [key]: !options[key] };
        if (!Object.values(next).some(Boolean)) return;
        setOptions(next);
        refresh(length, next);
    };

    const copy = () => {
        navigator.clipboard.writeText(password);
        setCopied(true);
    };

    return (
        <div className="bg-white border border-slate-200 p-6">
            <div className="bg-slate-900 text-green-400 font-mono text-lg md:text-xl p-4 break-all min-h-[68px] flex items-center">
                {password}
            </div>

            <div className="flex flex-wrap gap-3 mt-4">
                <button
                    type="button"
                    onClick={() => refresh(length, options)}
                    className="inline-flex items-center gap-2 bg-green-600 text-white text-sm font-bold px-4 py-2 hover:bg-green-700"
                >
                    <RefreshCw className="w-4 h-4" /> {t.regenerate}
                </button>
                <button
                    type="button"
                    onClick={copy}
                    className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 text-sm font-bold px-4 py-2 hover:bg-slate-50"
                >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? t.copied : t.copy}
                </button>
            </div>

            <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-slate-700">{t.length}</label>
                    <span className="text-sm font-mono text-slate-500">{length}</span>
                </div>
                <input
                    type="range"
                    min="6"
                    max="40"
                    value={length}
                    onChange={(e) => changeLength(Number(e.target.value))}
                    className="w-full accent-green-600"
                />
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-5">
                {OPTIONS.map((key) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={options[key]}
                            onChange={() => toggle(key)}
                            className="accent-green-600 w-4 h-4"
                        />
                        {t[key]}
                    </label>
                ))}
            </div>
        </div>
    );
}