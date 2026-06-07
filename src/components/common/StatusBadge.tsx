import type { DecisionStatus } from '../../types';

const statusConfig: Record<DecisionStatus, { bg: string; text: string; dot: string; darkBg: string; darkText: string }> = {
  'Eligible': { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700', dot: 'bg-emerald-50 dark:bg-emerald-900/200', darkBg: 'dark:bg-emerald-900/30', darkText: 'dark:text-emerald-400' },
  'Not Eligible': { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700', dot: 'bg-red-50 dark:bg-red-900/200', darkBg: 'dark:bg-red-900/30', darkText: 'dark:text-red-400' },
  'Review': { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700', dot: 'bg-amber-50 dark:bg-amber-900/200', darkBg: 'dark:bg-amber-900/30', darkText: 'dark:text-amber-400' },
};

export default function StatusBadge({ status }: { status: DecisionStatus }) {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text} ${config.darkBg} ${config.darkText}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {status}
    </span>
  );
}
