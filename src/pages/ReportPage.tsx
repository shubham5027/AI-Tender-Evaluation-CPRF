import { useEffect } from 'react';
import { FileText, Download, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import Header from '../components/layout/Header';
import StatusBadge from '../components/common/StatusBadge';
import ConfidenceIndicator from '../components/common/ConfidenceIndicator';
import { useAppStore } from '../store/useAppStore';
import type { DecisionStatus } from '../types';

export default function ReportPage() {
  const { getSelectedTender, isLoading, useMockData } = useAppStore();
  const tender = getSelectedTender();

  useEffect(() => {
    if (tender && !useMockData && tender.evaluations.length === 0 && tender.bidders.length > 0) {
      // Refresh if evaluations might be pending
    }
  }, [tender?.id]);

  const evaluations = tender?.evaluations || [];
  const bidders = tender?.bidders || [];

  const decisionIcon = {
    'Eligible': <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    'Not Eligible': <XCircle className="w-4 h-4 text-red-500" />,
    'Review': <AlertTriangle className="w-4 h-4 text-amber-500" />,
  };

  const summaryByBidder = bidders.map((b) => {
    const bidderEvals = evaluations.filter((e) => e.bidderId === b.id);
    const eligible = bidderEvals.filter((e) => e.decision === 'Eligible').length;
    const notEligible = bidderEvals.filter((e) => e.decision === 'Not Eligible').length;
    const review = bidderEvals.filter((e) => e.decision === 'Review').length;
    const mandatory = bidderEvals.filter((e) => {
      const criterion = tender?.criteria.find((c) => c.id === e.criterionId);
      return criterion?.weight === 'Mandatory';
    });
    const mandatoryPass = mandatory.filter((e) => e.decision === 'Eligible').length;
    const overallStatus: DecisionStatus = notEligible > 0 ? 'Not Eligible' : review > 0 ? 'Review' : 'Eligible';
    return {
      bidder: b,
      eligible,
      notEligible,
      review,
      total: bidderEvals.length,
      mandatoryTotal: mandatory.length,
      mandatoryPass,
      overallStatus,
    };
  });

  if (isLoading) {
    return (
      <div>
        <Header title="Detailed Report" subtitle="Full audit trail of evaluation decisions" />
        <div className="p-8">
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Loader2 className="w-8 h-8 text-navy-600 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading report data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!tender) {
    return (
      <div>
        <Header title="Detailed Report" subtitle="Full audit trail of evaluation decisions" />
        <div className="p-8">
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-sm text-gray-500">No tender selected. Select a tender from the dashboard.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Detailed Report" subtitle="Full audit trail of evaluation decisions" />
      <div className="p-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{tender.title}</h2>
              <p className="text-xs text-gray-500 mt-0.5">Reference: {tender.referenceNo}</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-navy-600 text-white text-sm font-medium rounded-lg hover:bg-navy-700 transition-colors">
              <Download className="w-4 h-4" /> Export PDF
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Total Bidders</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{bidders.length}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Total Evaluations</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{evaluations.length}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Date Generated</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{new Date().toLocaleDateString('en-IN')}</p>
            </div>
          </div>
        </div>

        {evaluations.length > 0 ? (
          <>
            <div className="bg-white rounded-xl border border-gray-200 mb-6">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Bidder Summary</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Bidder</th>
                      <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Eligible</th>
                      <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Not Eligible</th>
                      <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Review</th>
                      <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Mandatory Pass</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Overall</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {summaryByBidder.map((row) => (
                      <tr key={row.bidder.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-gray-900">{row.bidder.name}</td>
                        <td className="px-4 py-3 text-center text-sm text-emerald-600 font-semibold">{row.eligible}</td>
                        <td className="px-4 py-3 text-center text-sm text-red-600 font-semibold">{row.notEligible}</td>
                        <td className="px-4 py-3 text-center text-sm text-amber-600 font-semibold">{row.review}</td>
                        <td className="px-4 py-3 text-center text-sm text-gray-700">{row.mandatoryPass}/{row.mandatoryTotal}</td>
                        <td className="px-4 py-3"><StatusBadge status={row.overallStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Full Audit Trail</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {bidders.map((bidder) => {
                  const bidderEvals = evaluations.filter((e) => e.bidderId === bidder.id);
                  if (bidderEvals.length === 0) return null;
                  return (
                    <div key={bidder.id} className="p-5">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">{bidder.name}</h4>
                      <div className="space-y-2">
                        {bidderEvals.map((evalItem) => (
                          <div key={evalItem.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex-shrink-0">{decisionIcon[evalItem.decision]}</div>
                            <div className="flex-1 min-w-0 grid grid-cols-4 gap-4 items-center">
                              <div>
                                <p className="text-xs font-medium text-gray-900">{evalItem.criterionName}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-600 truncate">{evalItem.extractedValue}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <FileText className="w-3 h-3 text-gray-400" />
                                <p className="text-xs text-navy-600 font-medium truncate">{evalItem.sourceDocument}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <StatusBadge status={evalItem.decision} />
                                <ConfidenceIndicator value={evalItem.confidence} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-sm text-gray-500">No evaluation data yet. Run the AI evaluation first.</p>
          </div>
        )}
      </div>
    </div>
  );
}
