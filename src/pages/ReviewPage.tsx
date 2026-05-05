import { useState } from 'react';
import { CheckCircle2, XCircle, CreditCard as Edit3, MessageSquare, Save, AlertTriangle } from 'lucide-react';
import Header from '../components/layout/Header';
import StatusBadge from '../components/common/StatusBadge';
import ConfidenceIndicator from '../components/common/ConfidenceIndicator';
import PageLoader from '../components/common/PageLoader';
import { useAppStore } from '../store/useAppStore';
import type { EvaluationResult, DecisionStatus } from '../types';

export default function ReviewPage() {
  const { getSelectedTender, updateEvaluation, updateEvaluationApi, selectedTenderId, isLoading } = useAppStore();
  const tender = getSelectedTender();
  const evaluations = tender?.evaluations.filter((e) => e.decision === 'Review') || [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [comment, setComment] = useState('');
  const [commentForId, setCommentForId] = useState<string | null>(null);

  const handleDecision = (evalId: string, decision: DecisionStatus) => {
    const updates = {
      decision,
      reviewedBy: 'Sh. A.K. Verma',
      reviewedAt: new Date().toISOString(),
      reviewComment: comment || undefined,
    };
    updateEvaluation(evalId, updates);
    // Also persist to backend
    if (selectedTenderId) {
      updateEvaluationApi(selectedTenderId, evalId, updates);
    }
    setCommentForId(null);
    setComment('');
  };

  const startEdit = (evalItem: EvaluationResult) => {
    setEditingId(evalItem.id);
    setEditValue(evalItem.extractedValue);
  };

  const saveEdit = (evalId: string) => {
    updateEvaluation(evalId, { extractedValue: editValue });
    setEditingId(null);
  };

  if (isLoading) {
    return (
      <div>
        <Header title="Manual Review" subtitle="Review and resolve items flagged for manual verification" />
        <div className="p-8">
          <PageLoader message="Loading review items..." />
        </div>
      </div>
    );
  }

  if (evaluations.length === 0) {
    return (
      <div>
        <Header title="Manual Review" subtitle="Review and resolve items flagged for manual verification" />
        <div className="p-8">
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All Clear</h3>
            <p className="text-sm text-gray-500">No items currently require manual review.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Manual Review" subtitle="Review and resolve items flagged for manual verification" />
      <div className="p-8">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">{evaluations.length} items require manual review</p>
            <p className="text-xs text-amber-600 mt-0.5">Review each item and approve, reject, or edit the extracted values as needed.</p>
          </div>
        </div>

        <div className="space-y-4">
          {evaluations.map((evalItem) => (
            <div key={evalItem.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900">{evalItem.bidderName}</h3>
                    <StatusBadge status={evalItem.decision} />
                  </div>
                  <p className="text-xs text-gray-500">{evalItem.criterionName}</p>
                </div>
                <ConfidenceIndicator value={evalItem.confidence} />
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">AI Explanation</p>
                <p className="text-sm text-gray-700">{evalItem.explanation}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">Extracted Value</p>
                  {editingId === evalItem.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                      />
                      <button onClick={() => saveEdit(evalItem.id)} className="p-1.5 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors">
                        <Save className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-900">{evalItem.extractedValue}</p>
                      <button onClick={() => startEdit(evalItem)} className="p-1 rounded hover:bg-gray-200 transition-colors">
                        <Edit3 className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">Source Document</p>
                  <p className="text-sm text-navy-600 font-medium">{evalItem.sourceDocument}</p>
                </div>
              </div>

              {commentForId === evalItem.id && (
                <div className="mb-4">
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Add Comment</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    placeholder="Add your review comments here..."
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleDecision(evalItem.id, 'Eligible')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </button>
                <button
                  onClick={() => handleDecision(evalItem.id, 'Not Eligible')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
                <button
                  onClick={() => setCommentForId(commentForId === evalItem.id ? null : evalItem.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    commentForId === evalItem.id
                      ? 'bg-navy-100 text-navy-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Comment
                </button>
                {evalItem.reviewComment && (
                  <p className="text-xs text-gray-500 ml-2 italic">"{evalItem.reviewComment}"</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
