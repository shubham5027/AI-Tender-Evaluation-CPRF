import type { DecisionStatus } from '../../types';

const statusConfig: Record<DecisionStatus, { bg: string; text: string; dot: string }> = {
  'Eligible': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'Not Eligible': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  'Review': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
};

export default function StatusBadge({ status }: { status: DecisionStatus }) {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {status}
    </span>
  );
}
