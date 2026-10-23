import { useParams, Navigate } from 'react-router-dom';
import { TOOLS, hubPath } from '@/lib/tools/config';
import ToolShell from '@/components/tools/ToolShell';
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
    const tool = TOOLS.find((x) => x.slug === slug);

    if (!tool) return <Navigate to={hubPath(lang)} replace />;

    const Calculator = CALCULATORS[tool.key];

    return (
        <ToolShell lang={lang} tool={tool}>
            <Calculator lang={lang} />
        </ToolShell>
    );
}