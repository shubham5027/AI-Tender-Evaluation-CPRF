import { useState } from 'react';
import { ChevronDown, ChevronRight, Brain, FileText, Filter, Play } from 'lucide-react';
import Header from '../components/layout/Header';
import StatusBadge from '../components/common/StatusBadge';
import ConfidenceIndicator from '../components/common/ConfidenceIndicator';
import ExplainModal from '../components/common/ExplainModal';
import Timeline from '../components/common/Timeline';
import PageLoader from '../components/common/PageLoader';
import { useAppStore } from '../store/useAppStore';
import type { EvaluationResult } from '../types';

export default function EvaluationPage() {
  const { getSelectedTender, timeline, runEvaluation, selectedTenderId, isParsing, isLoading } = useAppStore();
  const tender = getSelectedTender();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationResult | null>(null);
  const [filterBidder, setFilterBidder] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const evaluations = tender?.evaluations || [];
  const bidders = tender?.bidders || [];

  const filtered = evaluations.filter((e) => {
    if (filterBidder !== 'all' && e.bidderId !== filterBidder) return false;
    if (filterStatus !== 'all' && e.decision !== filterStatus) return false;
    return true;
  });

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading && !tender) {
    return (
      <div>
        <Header title="AI Evaluation" subtitle="Detailed evaluation results with explainable AI decisions" />
        <div className="p-8">
          <PageLoader message="Loading evaluation data..." />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="AI Evaluation" subtitle="Detailed evaluation results with explainable AI decisions" />
      <div className="p-8">
        {isParsing && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <Brain className="w-5 h-5 text-blue-600 animate-pulse flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800">AI evaluation in progress...</p>
              <p className="text-xs text-blue-600 mt-0.5">Analyzing bidder documents against eligibility criteria.</p>
            </div>
          </div>
        )}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-3">Evaluation Progress</p>
          <Timeline steps={timeline} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-navy-600" />
              <h2 className="text-sm font-semibold text-gray-900">Evaluation Results</h2>
              <span className="text-xs text-gray-400">({filtered.length} records)</span>
            </div>
            <div className="flex items-center gap-3">
              {selectedTenderId && (
                <button
                  onClick={() => runEvaluation(selectedTenderId)}
                  disabled={isParsing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-600 text-white text-xs font-medium rounded-lg hover:bg-navy-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-3.5 h-3.5" /> {isParsing ? 'Evaluating...' : 'Run Evaluation'}
                </button>
              )}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select
                  value={filterBidder}
                  onChange={(e) => setFilterBidder(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500 bg-white"
                >
                  <option value="all">All Bidders</option>
                  {bidders.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500 bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="Eligible">Eligible</option>
                <option value="Not Eligible">Not Eligible</option>
                <option value="Review">Needs Review</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="w-8 px-3 py-3" />
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Bidder</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Criterion</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Extracted Value</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Decision</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Confidence</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Explain</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((evalItem) => (
                  <>
                    <tr key={evalItem.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3">
                        <button onClick={() => toggleRow(evalItem.id)} className="p-0.5 rounded hover:bg-gray-200 transition-colors">
                          {expandedRows.has(evalItem.id) ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[180px] truncate">{evalItem.bidderName}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{evalItem.criterionName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">{evalItem.extractedValue}</td>
                      <td className="px-4 py-3"><StatusBadge status={evalItem.decision} /></td>
                      <td className="px-4 py-3"><ConfidenceIndicator value={evalItem.confidence} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs text-navy-600 font-medium truncate max-w-[120px]">{evalItem.sourceDocument}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedEvaluation(evalItem)}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-navy-600 bg-navy-50 rounded-lg hover:bg-navy-100 transition-colors"
                        >
                          <Brain className="w-3 h-3" /> Explain
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(evalItem.id) && (
                      <tr key={`${evalItem.id}-detail`} className="bg-gray-50">
                        <td colSpan={8} className="px-8 py-4">
                          <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">AI Reasoning</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{evalItem.explanation}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedEvaluation && (
        <ExplainModal evaluation={selectedEvaluation} onClose={() => setSelectedEvaluation(null)} />
      )}
    </div>
  );
}
