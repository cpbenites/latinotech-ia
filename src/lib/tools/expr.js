// Avaliador aritmético seguro para as expressões dos utilitários gerados por IA.
// Aceita números, variáveis, + - * / % ( ) e algumas funções. Nunca usa eval.

const FUNCS = {
    min: (...a) => Math.min(...a),
    max: (...a) => Math.max(...a),
    abs: Math.abs,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
};

function tokenize(src) {
    const out = [];
    let i = 0;

    while (i < src.length) {
        const c = src[i];

        if (/\s/.test(c)) {
            i++;
            continue;
        }

        if (/[0-9.]/.test(c)) {
            let n = '';
            while (i < src.length && /[0-9.]/.test(src[i])) n += src[i++];
            out.push({ t: 'num', v: parseFloat(n) });
            continue;
        }

        if (/[a-zA-Z_]/.test(c)) {
            let id = '';
            while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) id += src[i++];
            out.push({ t: 'id', v: id });
            continue;
        }

        if ('+-*/%(),'.includes(c)) {
            out.push({ t: c });
            i++;
            continue;
        }

        throw new Error(`Caractere inválido: ${c}`);
    }

    return out;
}

function parse(tokens, vars) {
    let p = 0;
    const peek = () => tokens[p];

    function expr() {
        let v = muldiv();
        while (peek() && (peek().t === '+' || peek().t === '-')) {
            const op = tokens[p++].t;
            const r = muldiv();
            v = op === '+' ? v + r : v - r;
        }
        return v;
    }

    function muldiv() {
        let v = unary();
        while (peek() && (peek().t === '*' || peek().t === '/' || peek().t === '%')) {
            const op = tokens[p++].t;
            const r = unary();
            if (op === '*') v = v * r;
            else if (op === '/') v = r === 0 ? NaN : v / r;
            else v = r === 0 ? NaN : v % r;
        }
        return v;
    }

    function unary() {
        if (peek() && peek().t === '-') {
            p++;
            return -unary();
        }
        if (peek() && peek().t === '+') {
            p++;
            return unary();
        }
        return primary();
    }

    function primary() {
        const tk = peek();
        if (!tk) return NaN;

        if (tk.t === 'num') {
            p++;
            return tk.v;
        }

        if (tk.t === '(') {
            p++;
            const v = expr();
            if (peek() && peek().t === ')') p++;
            return v;
        }

        if (tk.t === 'id') {
            p++;
            const name = tk.v;

            if (peek() && peek().t === '(') {
                p++;
                const args = [];
                if (peek() && peek().t !== ')') {
                    args.push(expr());
                    while (peek() && peek().t === ',') {
                        p++;
                        args.push(expr());
                    }
                }
                if (peek() && peek().t === ')') p++;
                const fn = FUNCS[name];
                return fn ? fn(...args) : NaN;
            }

            const v = vars[name];
            return Number.isFinite(v) ? v : 0;
        }

        return NaN;
    }

    return expr();
}

export function evaluate(expression, vars) {
    try {
        return parse(tokenize(String(expression || '')), vars);
    } catch {
        return NaN;
    }
}