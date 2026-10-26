function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

const SETS = {
    lowercase: 'abcdefghijkmnopqrstuvwxyz',
    uppercase: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
    digits: '23456789',
    symbols: '!@#$%&*?-_+=',
};

export function generatePassword(spec = {}) {
    const length = Math.min(40, Math.max(6, Number(spec.length) || 16));

    const enabled = ['lowercase', 'uppercase', 'digits', 'symbols'].filter((key) =>
        key === 'lowercase' ? spec[key] !== false : spec[key] === true
    );
    const active = enabled.length ? enabled : ['lowercase'];

    const all = active.map((key) => SETS[key]).join('');
    const out = active.map((key) => pick(SETS[key]));

    while (out.length < length) out.push(pick(all));

    return shuffle(out).slice(0, length).join('');
}

export function generateNumbers(spec = {}) {
    const rawMin = Number(spec.min);
    const rawMax = Number(spec.max);
    const min = Number.isFinite(rawMin) ? Math.ceil(rawMin) : 1;
    const max = Number.isFinite(rawMax) ? Math.floor(rawMax) : 60;
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const count = Math.min(100, Math.max(1, Number(spec.count) || 6));

    if (spec.unique !== false) {
        const pool = [];
        for (let i = lo; i <= hi; i++) pool.push(i);
        const picked = shuffle(pool).slice(0, Math.min(count, pool.length));
        return spec.sort !== false ? picked.sort((a, b) => a - b) : picked;
    }

    const out = [];
    for (let i = 0; i < count; i++) out.push(lo + Math.floor(Math.random() * (hi - lo + 1)));
    return spec.sort !== false ? out.sort((a, b) => a - b) : out;
}

export function renderTemplate(template, vars = {}) {
    return String(template || '').replace(/\{([^{}]+)\}/g, (match, raw) => {
        const token = raw.trim();

        if (token.startsWith('#')) {
            const [rawMin, rawMax] = token.slice(1).split('-');
            const lo = Number(rawMin);
            const hi = Number(rawMax);
            if (!Number.isFinite(lo) || !Number.isFinite(hi)) return '';
            const min = Math.min(lo, hi);
            const max = Math.max(lo, hi);
            return String(min + Math.floor(Math.random() * (max - min + 1)));
        }

        const source = vars[token];
        if (Array.isArray(source) && source.length) return String(pick(source));
        if (typeof source === 'string' && source) return source;
        return '';
    });
}

export function generateTemplate(spec = {}, values = {}) {
    const count = Math.min(20, Math.max(1, Number(spec.count) || 5));
    const vars = { ...(spec.pools || {}), ...values };

    const out = [];
    for (let i = 0; i < count; i++) out.push(renderTemplate(spec.template, vars));
    return out;
}