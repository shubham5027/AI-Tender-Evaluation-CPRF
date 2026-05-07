import { useMemo } from 'react';
import { CheckCircle2, Clock3, Loader2 } from 'lucide-react';
import Header from '../components/layout/Header';
import { useAppStore } from '../store/useAppStore';
import type { TimelineStep } from '../types';

function getProgressPercent(steps: TimelineStep[]) {
  if (steps.length === 0) return 0;
  const weighted = steps.reduce((sum, step) => {
    if (step.status === 'completed') return sum + 1;
    if (step.status === 'current') return sum + 0.5;
    return sum;
  }, 0);
  return Math.round((weighted / steps.length) * 100);
}

export default function WorkflowPreviewPage() {
  const { getSelectedTender, timeline, isParsing } = useAppStore();
  const tender = getSelectedTender();

  if (!tender) {
    return (
      <div>
        <Header title="Auto Workflow Preview" subtitle="Live pipeline stage visibility for selected tender" />
        <div className="p-8">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-sm text-gray-500">
            Select or create a tender first to view workflow stages.
          </div>
        </div>
      </div>
    );
  }

  const checks = [
    { label: 'Tender Uploaded', ok: true, hint: tender.referenceNo || 'Reference pending' },
    { label: 'Criteria Extracted', ok: tender.criteria.length > 0 },
    { label: 'Bidder Documents Received', ok: tender.bidders.length > 0 },
    { label: 'AI Evaluation Generated', ok: tender.evaluations.length > 0 },
    { label: 'Manual Review Cleared', ok: tender.evaluations.length > 0 && !tender.evaluations.some((evaluation) => evaluation.decision === 'Review') },
  ];

  const progressPercent = getProgressPercent(timeline);
  const completedCount = timeline.filter((step) => step.status === 'completed').length;
  const currentCount = timeline.filter((step) => step.status === 'current').length;

  const nextActions = useMemo(() => {
    if (tender.criteria.length === 0) return ['Extract criteria from tender policy document.'];
    if (tender.bidders.length === 0) return ['Upload bidder documents to start qualification analysis.'];
    if (tender.evaluations.length === 0) return ['Run AI evaluation to generate criterion-level decisions.'];
    if (tender.evaluations.some((evaluation) => evaluation.decision === 'Review')) {
      return ['Clear review flags in Manual Review for ambiguous criteria.'];
    }
    return ['Generate and export final report for procurement sign-off.'];
  }, [tender.bidders.length, tender.criteria.length, tender.evaluations]);

  const pendingReviews = tender.evaluations.filter((evaluation) => evaluation.decision === 'Review').length;
  const failedBidders = new Set(
    tender.evaluations
      .filter((evaluation) => evaluation.decision === 'Not Eligible')
      .map((evaluation) => evaluation.bidderId)
  ).size;

  return (
    <div>
      <Header title="Auto Workflow Preview" subtitle="Live pipeline stage visibility for selected tender" />
      <div className="p-8 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Pipeline Completion</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {completedCount} completed, {currentCount} in progress
              </p>
            </div>
            <p className="text-2xl font-bold text-navy-700">{progressPercent}%</p>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full mt-4 overflow-hidden">
            <div className="h-full bg-navy-600 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <InfoCard label="Bidders In Workflow" value={tender.bidders.length.toString()} tone="text-navy-700" />
          <InfoCard label="Evaluations Generated" value={tender.evaluations.length.toString()} tone="text-emerald-700" />
          <InfoCard label="Pending Reviews" value={pendingReviews.toString()} tone="text-amber-700" />
          <InfoCard label="Failed Bidders" value={failedBidders.toString()} tone="text-red-700" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Stage Checklist</h2>
            <div className="space-y-3">
              {checks.map((check) => (
                <div key={check.label} className="flex items-start gap-3">
                  {check.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                  ) : (
                    <Clock3 className="w-4 h-4 text-amber-600 mt-0.5" />
                  )}
                  <div>
                    <p className={`text-sm ${check.ok ? 'text-gray-900' : 'text-gray-500'}`}>{check.label}</p>
                    {check.hint && <p className="text-[11px] text-gray-400 mt-0.5">{check.hint}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Pipeline Timeline</h2>
            <div className="space-y-3">
              {timeline.map((step) => (
                <div key={step.id} className="flex items-start gap-3">
                  {step.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                  ) : step.status === 'current' || (isParsing && step.label.includes('AI Evaluation')) ? (
                    <Loader2 className="w-4 h-4 text-blue-600 mt-0.5 animate-spin" />
                  ) : (
                    <Clock3 className="w-4 h-4 text-gray-400 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{step.label}</p>
                    <p className="text-xs text-gray-500">{step.timestamp || 'Pending'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Recommended Next Actions</h2>
          <div className="space-y-2">
            {nextActions.map((action) => (
              <div key={action} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-navy-50 border border-navy-100">
                <div className="w-1.5 h-1.5 rounded-full bg-navy-600 mt-1.5" />
                <p className="text-sm text-gray-800">{action}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}
