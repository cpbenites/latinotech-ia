import PasswordGenerator from './PasswordGenerator';
import NumbersGenerator from './NumbersGenerator';
import TemplateGenerator from './TemplateGenerator';

export default function GeneratedGeneratorView({ lang, tool }) {
    const spec = tool.generator || {};

    if (spec.type === 'password') return <PasswordGenerator key={tool.slug} lang={lang} spec={spec} />;
    if (spec.type === 'numbers') return <NumbersGenerator key={tool.slug} lang={lang} spec={spec} />;
    return <TemplateGenerator key={tool.slug} lang={lang} spec={spec} />;
}