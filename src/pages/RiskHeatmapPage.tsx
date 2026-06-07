import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Header from '../components/layout/Header';
import { useAppStore } from '../store/useAppStore';
import type { CriterionCategory, DecisionStatus, EvaluationResult } from '../types';

function decisionCellClass(decision?: DecisionStatus) {
  if (decision === 'Eligible') return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 border-emerald-200';
  if (decision === 'Not Eligible') return 'bg-red-50 dark:bg-red-900/20 text-red-700 border-red-200';
  if (decision === 'Review') return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 border-amber-200';
  return 'bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700';
}

function scoreEvaluationRisk(evaluation?: EvaluationResult) {
  if (!evaluation) return 1;
  if (evaluation.decision === 'Not Eligible') return 3;
  if (evaluation.decision === 'Review') return 2;
  return 0;
}

function formatConfidence(confidence?: number) {
  if (typeof confidence !== 'number') return '--';
  return `${Math.round(confidence * 100)}%`;
}

export default function RiskHeatmapPage() {
  const { getSelectedTender } = useAppStore();
  const tender = getSelectedTender();
  const [selectedBidder, setSelectedBidder] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | CriterionCategory>('all');
  const [showOnlyRiskCells, setShowOnlyRiskCells] = useState(false);

  if (!tender) {
    return (
      <div>
        <Header title="Risk Heatmap" subtitle="Bidder vs criterion risk visibility matrix" />
        <div className="p-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
            Select or create a tender first to view heatmap insights.
          </div>
        </div>
      </div>
    );
  }

  const evaluationByPair = useMemo(() => {
    const map = new Map<string, EvaluationResult>();
    tender.evaluations.forEach((evaluation) => {
      map.set(`${evaluation.bidderId}_${evaluation.criterionId}`, evaluation);
    });
    return map;
  }, [tender.evaluations]);

  const visibleBidders = tender.bidders.filter((bidder) => selectedBidder === 'all' || bidder.id === selectedBidder);
  const visibleCriteria = tender.criteria.filter((criterion) => selectedCategory === 'all' || criterion.category === selectedCategory);

  const summary = useMemo(() => {
    const stats = { eligible: 0, review: 0, notEligible: 0, pending: 0 };

    visibleBidders.forEach((bidder) => {
      visibleCriteria.forEach((criterion) => {
        const evaluation = evaluationByPair.get(`${bidder.id}_${criterion.id}`);
        if (!evaluation) {
          stats.pending += 1;
          return;
        }
        if (evaluation.decision === 'Eligible') stats.eligible += 1;
        else if (evaluation.decision === 'Review') stats.review += 1;
        else stats.notEligible += 1;
      });
    });

    const total = visibleBidders.length * visibleCriteria.length;
    const completed = stats.eligible + stats.review + stats.notEligible;
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { ...stats, total, completionPct };
  }, [evaluationByPair, visibleBidders, visibleCriteria]);

  const bidderRiskRows = useMemo(() => {
    return visibleBidders
      .map((bidder) => {
        const rowRisk = visibleCriteria.reduce((acc, criterion) => {
          const evaluation = evaluationByPair.get(`${bidder.id}_${criterion.id}`);
          return acc + scoreEvaluationRisk(evaluation);
        }, 0);
        return { bidderId: bidder.id, bidderName: bidder.name, rowRisk };
      })
      .sort((a, b) => b.rowRisk - a.rowRisk);
  }, [evaluationByPair, visibleBidders, visibleCriteria]);

  const criterionRiskRows = useMemo(() => {
    return visibleCriteria
      .map((criterion) => {
        const criterionEvaluations = visibleBidders
          .map((bidder) => evaluationByPair.get(`${bidder.id}_${criterion.id}`))
          .filter((value): value is EvaluationResult => Boolean(value));
        const notEligible = criterionEvaluations.filter((evaluation) => evaluation.decision === 'Not Eligible').length;
        const review = criterionEvaluations.filter((evaluation) => evaluation.decision === 'Review').length;
        const total = criterionEvaluations.length;
        const riskIndex = total > 0 ? Math.round(((notEligible * 2 + review) / (total * 2)) * 100) : 0;
        return { criterion, notEligible, review, total, riskIndex };
      })
      .sort((a, b) => b.riskIndex - a.riskIndex);
  }, [evaluationByPair, visibleBidders, visibleCriteria]);

  return (
    <div>
      <Header title="Risk Heatmap" subtitle="Bidder vs criterion risk visibility matrix" />
      <div className="p-8 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Heatmap Controls</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">
                Green: Eligible, Amber: Review, Red: Not Eligible, Grey: Pending
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedBidder}
                onChange={(event) => setSelectedBidder(event.target.value)}
                className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500 bg-white dark:bg-gray-800"
              >
                <option value="all">All Bidders</option>
                {tender.bidders.map((bidder) => (
                  <option key={bidder.id} value={bidder.id}>
                    {bidder.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value as 'all' | CriterionCategory)}
                className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500 bg-white dark:bg-gray-800"
              >
                <option value="all">All Categories</option>
                <option value="Technical">Technical</option>
                <option value="Financial">Financial</option>
                <option value="Compliance">Compliance</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={showOnlyRiskCells}
                  onChange={(event) => setShowOnlyRiskCells(event.target.checked)}
                  className="rounded border-gray-300 text-navy-600 focus:ring-navy-500"
                />
                Show only risk cells
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard label="Completion" value={`${summary.completionPct}%`} tone="text-navy-700" />
          <MetricCard label="Eligible" value={summary.eligible.toString()} tone="text-emerald-700" />
          <MetricCard label="Needs Review" value={summary.review.toString()} tone="text-amber-700" />
          <MetricCard label="Not Eligible" value={summary.notEligible.toString()} tone="text-red-700" />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Decision Heatmap</h2>
          <div className="overflow-auto">
            <table className="min-w-[960px] w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-white dark:bg-gray-800 text-left text-xs font-semibold text-gray-600 p-2 border-b border-gray-200 dark:border-gray-700">
                    Bidder
                  </th>
                  {visibleCriteria.map((criterion) => (
                    <th key={criterion.id} className="text-left text-xs font-semibold text-gray-600 p-2 border-b border-gray-200 dark:border-gray-700 min-w-[180px]">
                      <p className="truncate">{criterion.name}</p>
                      <p className="text-[10px] font-normal text-gray-400 dark:text-gray-500 mt-0.5">{criterion.category}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleBidders.map((bidder) => (
                  <tr key={bidder.id}>
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-2 border-b border-gray-100 dark:border-gray-700 text-xs font-medium text-gray-900 dark:text-gray-100">
                      {bidder.name}
                    </td>
                    {visibleCriteria.map((criterion) => {
                      const evaluation = evaluationByPair.get(`${bidder.id}_${criterion.id}`);
                      if (showOnlyRiskCells && evaluation?.decision === 'Eligible') {
                        return (
                          <td key={`${bidder.id}_${criterion.id}`} className="p-2 border-b border-gray-100 dark:border-gray-700">
                            <div className="text-[11px] px-2 py-1 rounded border bg-white dark:bg-gray-800 text-gray-300 border-gray-100 dark:border-gray-700">
                              Hidden
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={`${bidder.id}_${criterion.id}`} className="p-2 border-b border-gray-100 dark:border-gray-700 align-top">
                          <div className={`text-[11px] px-2 py-1 rounded border ${decisionCellClass(evaluation?.decision)}`}>
                            <p>{evaluation?.decision || 'Pending'}</p>
                            <p className="text-[10px] opacity-80 mt-0.5">Confidence: {formatConfidence(evaluation?.confidence)}</p>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Top Risk Bidders</h3>
            <div className="space-y-2">
              {bidderRiskRows.slice(0, 6).map((row) => (
                <div key={row.bidderId} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                  <p className="text-sm text-gray-800">{row.bidderName}</p>
                  <span className={`text-xs font-semibold ${row.rowRisk >= 8 ? 'text-red-600' : row.rowRisk >= 4 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    Risk Score: {row.rowRisk}
                  </span>
                </div>
              ))}
              {bidderRiskRows.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">No bidders available in this filter.</p>}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Criterion Hotspots</h3>
            </div>
            <div className="space-y-2">
              {criterionRiskRows.slice(0, 6).map((row) => (
                <div key={row.criterion.id} className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-800">{row.criterion.name}</p>
                    <span className={`text-xs font-semibold ${row.riskIndex >= 60 ? 'text-red-600' : row.riskIndex >= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {row.riskIndex}% risk
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                    Not Eligible: {row.notEligible}, Review: {row.review}, Evaluated: {row.total}
                  </p>
                </div>
              ))}
              {criterionRiskRows.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">No criteria available in this filter.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}
