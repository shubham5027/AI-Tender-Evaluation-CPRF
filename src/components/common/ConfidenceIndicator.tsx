export default function ConfidenceIndicator({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  let color = 'bg-emerald-50 dark:bg-emerald-900/200';
  let textColor = 'text-emerald-700';
  if (pct < 70) {
    color = 'bg-red-50 dark:bg-red-900/200';
    textColor = 'text-red-700';
  } else if (pct < 85) {
    color = 'bg-amber-50 dark:bg-amber-900/200';
    textColor = 'text-amber-700';
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold ${textColor}`}>{pct}%</span>
    </div>
  );
}
