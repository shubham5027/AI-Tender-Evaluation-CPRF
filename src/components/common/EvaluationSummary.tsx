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
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-indigo-200 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Mandatory Criteria</p>
              <p className="text-2xl font-bold text-indigo-900 mt-1">{mandatoryPassRate}%</p>
            </div>
            <TrendingUp className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex items-center gap-2 text-sm text-indigo-700">
            <CheckCircle2 className="w-4 h-4" />
            <span>{mandatoryEligible} of {mandatoryCriteria.length} passed</span>
          </div>
          {mandatoryNotEligible > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-700 mt-2">
              <XCircle className="w-4 h-4" />
              <span>{mandatoryNotEligible} failed</span>
            </div>
          )}
        </div>

        {/* Optional Criteria */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg border border-emerald-200 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Optional Criteria</p>
              <p className="text-2xl font-bold text-emerald-900 mt-1">{optionalPassRate}%</p>
            </div>
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            <span>{optionalEligible} of {optionalCriteria.length} passed</span>
          </div>
        </div>

        {/* Overall Status */}
        <div className={`rounded-lg border p-5 ${
          isEligible
            ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200'
            : needsReview
            ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200'
            : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200'
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
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Evaluation Breakdown</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Eligible Evaluations</span>
              <span className="text-sm font-bold text-emerald-600">{totalEligible}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${evaluations.length > 0 ? (totalEligible / evaluations.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Not Eligible Evaluations</span>
              <span className="text-sm font-bold text-red-600">{totalNotEligible}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${evaluations.length > 0 ? (totalNotEligible / evaluations.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Flagged for Review</span>
              <span className="text-sm font-bold text-amber-600">{totalReview}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${evaluations.length > 0 ? (totalReview / evaluations.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Criteria Details */}
      {mandatoryNotEligible > 0 && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900 text-sm mb-1">Critical: Mandatory Criteria Not Met</h4>
              <p className="text-sm text-red-800">
                {mandatoryNotEligible} mandatory criteria failed. {bidder ? 'This bidder' : 'These bidders'} cannot proceed to selection.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Review Required */}
      {needsReview && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900 text-sm mb-1">Manual Review Required</h4>
              <p className="text-sm text-amber-800">
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
