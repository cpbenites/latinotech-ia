export default function Stat({ label, value, accent = false, hint }) {
    return (
        <div className={`border p-4 ${accent ? 'border-green-600 bg-green-50' : 'border-slate-200 bg-white'}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">{label}</p>
            <p className={`text-xl font-black leading-tight ${accent ? 'text-green-700' : 'text-slate-900'}`}>{value}</p>
            {hint && <p className="text-xs text-slate-400 mt-1 leading-snug">{hint}</p>}
        </div>
    );
}