import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { TOOLS, hubPath } from '@/lib/tools/config';
import { generatedCopy } from '@/lib/tools/toolCopy';
import ToolShell from '@/components/tools/ToolShell';
import GeneratedToolView from '@/components/tools/GeneratedToolView';
import AiCostCalculator from '@/components/tools/AiCostCalculator';
import DebtPayoffSimulator from '@/components/tools/DebtPayoffSimulator';
import AutomationRoiCalculator from '@/components/tools/AutomationRoiCalculator';

const CALCULATORS = {
    aiCost: AiCostCalculator,
    debtPayoff: DebtPayoffSimulator,
    automationRoi: AutomationRoiCalculator,
};

export default function ToolPage({ lang }) {
    const { slug } = useParams();
    const staticTool = TOOLS.find((x) => x.slug === slug);
    const [record, setRecord] = useState(null);
    const [loaded, setLoaded] = useState(Boolean(staticTool));

    useEffect(() => {
        if (staticTool) return;
        let active = true;
        setLoaded(false);
        setRecord(null);

        base44.entities.GeneratedTool.filter({ slug, status: 'published' }, { limit: 1 }).then((page) => {
            if (!active) return;
            setRecord(page.items[0] || null);
            setLoaded(true);
        });

        return () => {
            active = false;
        };
    }, [slug, staticTool]);

    if (staticTool) {
        const Calculator = CALCULATORS[staticTool.key];
        return (
            <ToolShell lang={lang} tool={staticTool}>
                <Calculator lang={lang} />
            </ToolShell>
        );
    }

    if (!loaded) {
        return (
            <div className="container mx-auto px-4 py-24 flex justify-center">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-green-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (!record) return <Navigate to={hubPath(lang)} replace />;

    return (
        <ToolShell lang={lang} tool={{ key: `gen-${record.slug}`, copy: generatedCopy(lang, record) }}>
            <GeneratedToolView key={record.slug} lang={lang} tool={record} />
        </ToolShell>
    );
}