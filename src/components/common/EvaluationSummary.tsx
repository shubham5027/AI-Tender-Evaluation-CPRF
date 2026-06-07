import { CheckCircle2, XCircle, AlertCircle, TrendingUp } from 'lucide-react';
import type { Tender, Bidder } from '../../types';

interface SummaryProps {
  tender: Tender;
  bidder?: Bidder;
}

export function EvaluationSummary({ tender, bidder }: SummaryProps) {
  const evaluations = bidder
    ? tender.evaluations.filter((e) => e.bidderId === bidder.id)
    : tender.evaluations;

  const criteria = tender.criteria;

  // Calculate mandatory criteria stats
  const mandatoryCriteria = criteria.filter((c) => c.weight === 'Mandatory');
  const mandatoryEvals = evaluations.filter((e) => {
    const criterion = criteria.find((c) => c.id === e.criterionId);
    return criterion?.weight === 'Mandatory';
  });
  const mandatoryEligible = mandatoryEvals.filter((e) => e.decision === 'Eligible').length;
  const mandatoryNotEligible = mandatoryEvals.filter((e) => e.decision === 'Not Eligible').length;

  // Calculate optional criteria stats
  const optionalCriteria = criteria.filter((c) => c.weight === 'Optional');
  const optionalEvals = evaluations.filter((e) => {
    const criterion = criteria.find((c) => c.id === e.criterionId);
    return criterion?.weight === 'Optional';
  });
  const optionalEligible = optionalEvals.filter((e) => e.decision === 'Eligible').length;

  // Overall calculations
  const totalEligible = evaluations.filter((e) => e.decision === 'Eligible').length;
  const totalNotEligible = evaluations.filter((e) => e.decision === 'Not Eligible').length;
  const totalReview = evaluations.filter((e) => e.decision === 'Review').length;

  const mandatoryPassRate = mandatoryCriteria.length > 0 
    ? Math.round((mandatoryEligible / mandatoryCriteria.length) * 100) 
    : 0;
  const optionalPassRate = optionalCriteria.length > 0 
    ? Math.round((optionalEligible / optionalCriteria.length) * 100) 
    : 0;

  const isEligible = mandatoryNotEligible === 0 && totalReview === 0;
  const needsReview = totalReview > 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Mandatory Criteria */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-indigo-900/30 dark:to-blue-900/30 rounded-lg border border-indigo-200 dark:border-indigo-800 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Mandatory Criteria</p>
              <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-200 mt-1">{mandatoryPassRate}%</p>
            </div>
            <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300">
            <CheckCircle2 className="w-4 h-4" />
            <span>{mandatoryEligible} of {mandatoryCriteria.length} passed</span>
          </div>
          {mandatoryNotEligible > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 mt-2">
              <XCircle className="w-4 h-4" />
              <span>{mandatoryNotEligible} failed</span>
            </div>
          )}
        </div>

        {/* Optional Criteria */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-lg border border-emerald-200 dark:border-emerald-800 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Optional Criteria</p>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-200 mt-1">{optionalPassRate}%</p>
            </div>
            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4" />
            <span>{optionalEligible} of {optionalCriteria.length} passed</span>
          </div>
        </div>

        {/* Overall Status */}
        <div className={`rounded-lg border p-5 ${
          isEligible
            ? 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30 border-emerald-200 dark:border-emerald-800'
            : needsReview
            ? 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 border-amber-200 dark:border-amber-800'
            : 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{
                color: isEligible ? '#047857' : needsReview ? '#92400e' : '#991b1b'
              }}>
                Overall Status
              </p>
              <p className="text-2xl font-bold mt-1" style={{
                color: isEligible ? '#065f46' : needsReview ? '#78350f' : '#7f1d1d'
              }}>
                {isEligible ? 'ELIGIBLE' : needsReview ? 'REVIEW' : 'NOT ELIGIBLE'}
              </p>
            </div>
            {isEligible && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            {needsReview && <AlertCircle className="w-5 h-5 text-amber-600" />}
            {!isEligible && !needsReview && <XCircle className="w-5 h-5 text-red-600" />}
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-4">Evaluation Breakdown</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Eligible Evaluations</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{totalEligible}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-emerald-50 dark:bg-emerald-900/200 h-2 rounded-full transition-all duration-300"
                style={{ width: `${evaluations.length > 0 ? (totalEligible / evaluations.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Not Eligible Evaluations</span>
              <span className="text-sm font-bold text-red-600 dark:text-red-400">{totalNotEligible}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-red-50 dark:bg-red-900/200 h-2 rounded-full transition-all duration-300"
                style={{ width: `${evaluations.length > 0 ? (totalNotEligible / evaluations.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Flagged for Review</span>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{totalReview}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-amber-50 dark:bg-amber-900/200 h-2 rounded-full transition-all duration-300"
                style={{ width: `${evaluations.length > 0 ? (totalReview / evaluations.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Criteria Details */}
      {mandatoryNotEligible > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900 dark:text-red-200 text-sm mb-1">Critical: Mandatory Criteria Not Met</h4>
              <p className="text-sm text-red-800 dark:text-red-300">
                {mandatoryNotEligible} mandatory criteria failed. {bidder ? 'This bidder' : 'These bidders'} cannot proceed to selection.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Review Required */}
      {needsReview && (
        <div className="bg-amber-50 dark:bg-amber-900/20 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900 dark:text-amber-200 text-sm mb-1">Manual Review Required</h4>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                {totalReview} evaluation{totalReview !== 1 ? 's' : ''} marked for manual review. Please verify before final approval.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EvaluationSummary;
