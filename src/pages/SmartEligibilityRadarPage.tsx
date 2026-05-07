import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, FileBarChart2, Scale } from 'lucide-react';
import type { ComponentType } from 'react';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import Header from '../components/layout/Header';
import { useAppStore } from '../store/useAppStore';
import type { CriterionCategory, EvaluationResult } from '../types';

const CATEGORY_ORDER: CriterionCategory[] = ['Technical', 'Financial', 'Compliance'];

function decisionScore(decision: EvaluationResult['decision']) {
  if (decision === 'Eligible') return 1;
  if (decision === 'Review') return 0.5;
  return 0;
}

export default function SmartEligibilityRadarPage() {
  const { getSelectedTender } = useAppStore();
  const tender = getSelectedTender();

  if (!tender) {
    return (
      <div>
        <Header title="Smart Eligibility Radar" subtitle="Criterion-level readiness and eligibility confidence" />
        <div className="p-8">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-sm text-gray-500">
            Select or create a tender first to view radar insights.
          </div>
        </div>
      </div>
    );
  }

  const bidderCount = tender.bidders.length;
  const mandatoryCount = tender.criteria.filter((criterion) => criterion.weight === 'Mandatory').length;
  const eligibleCount = tender.evaluations.filter((evaluation) => evaluation.decision === 'Eligible').length;
  const reviewCount = tender.evaluations.filter((evaluation) => evaluation.decision === 'Review').length;

  const criterionMap = useMemo(() => {
    return new Map(tender.criteria.map((criterion) => [criterion.id, criterion]));
  }, [tender.criteria]);

  const categoryStats = useMemo(() => {
    return CATEGORY_ORDER.map((category) => {
      const criteriaInCategory = tender.criteria.filter((criterion) => criterion.category === category);
      const criterionIds = new Set(criteriaInCategory.map((criterion) => criterion.id));
      const evaluationsInCategory = tender.evaluations.filter((evaluation) => criterionIds.has(evaluation.criterionId));
      const eligible = evaluationsInCategory.filter((evaluation) => evaluation.decision === 'Eligible').length;
      const total = evaluationsInCategory.length;
      const readiness = total > 0
        ? Math.round((evaluationsInCategory.reduce((sum, evaluation) => sum + decisionScore(evaluation.decision), 0) / total) * 100)
        : 0;
      return { category, criteria: criteriaInCategory.length, eligible, total, readiness };
    });
  }, [tender.criteria, tender.evaluations]);

  const bidderReadiness = useMemo(() => {
    return tender.bidders
      .map((bidder) => {
        const bidderEvals = tender.evaluations.filter((evaluation) => evaluation.bidderId === bidder.id);
        const mandatoryEvals = bidderEvals.filter((evaluation) => criterionMap.get(evaluation.criterionId)?.weight === 'Mandatory');
        const mandatoryFails = mandatoryEvals.filter((evaluation) => evaluation.decision === 'Not Eligible').length;
        const reviewFlags = bidderEvals.filter((evaluation) => evaluation.decision === 'Review').length;
        const score = bidderEvals.length > 0
          ? Math.round((bidderEvals.reduce((sum, evaluation) => sum + decisionScore(evaluation.decision), 0) / bidderEvals.length) * 100)
          : 0;
        const confidenceAvg = bidderEvals.length > 0
          ? Math.round((bidderEvals.reduce((sum, evaluation) => sum + evaluation.confidence, 0) / bidderEvals.length) * 100)
          : 0;

        let status: 'Eligible' | 'Review' | 'Not Eligible' = 'Eligible';
        if (mandatoryFails > 0) status = 'Not Eligible';
        else if (reviewFlags > 0 || bidderEvals.length === 0) status = 'Review';

        return { bidder, score, confidenceAvg, mandatoryFails, reviewFlags, status };
      })
      .sort((a, b) => b.score - a.score);
  }, [criterionMap, tender.bidders, tender.evaluations]);

  const blockerCriteria = useMemo(() => {
    return tender.criteria
      .map((criterion) => {
        const evaluations = tender.evaluations.filter((evaluation) => evaluation.criterionId === criterion.id);
        const notEligible = evaluations.filter((evaluation) => evaluation.decision === 'Not Eligible').length;
        const review = evaluations.filter((evaluation) => evaluation.decision === 'Review').length;
        const blockerIndex = notEligible * 2 + review;
        return { criterion, notEligible, review, blockerIndex, total: evaluations.length };
      })
      .filter((row) => row.blockerIndex > 0)
      .sort((a, b) => b.blockerIndex - a.blockerIndex);
  }, [tender.criteria, tender.evaluations]);

  return (
    <div>
      <Header title="Smart Eligibility Radar" subtitle="Criterion-level readiness and eligibility confidence" />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
          <StatCard label="Total Bidders" value={bidderCount} icon={Scale} color="text-navy-600" />
          <StatCard label="Mandatory Criteria" value={mandatoryCount} icon={FileBarChart2} color="text-red-600" />
          <StatCard label="Eligible Decisions" value={eligibleCount} icon={CheckCircle2} color="text-emerald-600" />
          <StatCard label="Needs Review" value={reviewCount} icon={AlertTriangle} color="text-amber-600" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Category Readiness Radar</h2>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={categoryStats}>
                  <PolarGrid stroke="#E5E7EB" />
                  <PolarAngleAxis dataKey="category" tick={{ fontSize: 12, fill: '#4B5563' }} />
                  <Radar
                    dataKey="readiness"
                    name="Readiness %"
                    stroke="#1A365D"
                    fill="#1A365D"
                    fillOpacity={0.35}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, 'Readiness']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {categoryStats.map((stat) => (
                <div key={stat.category} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-700">{stat.category}</p>
                  <p className="text-xl font-bold text-navy-700 mt-1">{stat.readiness}%</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {stat.eligible}/{stat.total} eligible across {stat.criteria} criteria
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Top Blocker Criteria</h2>
            <div className="space-y-2.5">
              {blockerCriteria.slice(0, 8).map((row) => (
                <div key={row.criterion.id} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900">{row.criterion.name}</p>
                    <span className={`text-xs font-semibold ${row.blockerIndex >= 4 ? 'text-red-600' : 'text-amber-600'}`}>
                      Blocker Score: {row.blockerIndex}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {row.criterion.category} | {row.criterion.weight} | Not Eligible {row.notEligible}, Review {row.review}, Evaluated {row.total}
                  </p>
                </div>
              ))}
              {blockerCriteria.length === 0 && (
                <p className="text-xs text-gray-500">
                  No blockers detected yet. Run evaluation or wait for additional bidder submissions.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Bidder Readiness Board</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Bidder</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Readiness</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Avg Confidence</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Mandatory Fails</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Review Flags</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Current Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bidderReadiness.map((row) => (
                  <tr key={row.bidder.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.bidder.name}</td>
                    <td className="px-4 py-3 text-sm text-navy-700 font-semibold">{row.score}%</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.confidenceAvg}%</td>
                    <td className="px-4 py-3 text-sm text-red-600">{row.mandatoryFails}</td>
                    <td className="px-4 py-3 text-sm text-amber-600">{row.reviewFlags}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          row.status === 'Eligible'
                            ? 'bg-emerald-50 text-emerald-700'
                            : row.status === 'Review'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {bidderReadiness.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                      No bidder data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}
