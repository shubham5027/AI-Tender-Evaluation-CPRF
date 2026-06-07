import { X, Brain, FileText, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { EvaluationResult } from '../../types';
import ConfidenceIndicator from './ConfidenceIndicator';
import StatusBadge from './StatusBadge';

interface ExplainModalProps {
  evaluation: EvaluationResult;
  onClose: () => void;
}

export default function ExplainModal({ evaluation, onClose }: ExplainModalProps) {
  const decisionIcon = {
    'Eligible': <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    'Not Eligible': <XCircle className="w-5 h-5 text-red-500" />,
    'Review': <AlertTriangle className="w-5 h-5 text-amber-500" />,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-navy-600 dark:text-navy-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">AI Decision Explanation</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Bidder</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{evaluation.bidderName}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Criterion</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{evaluation.criterionName}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Extracted Value</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 dark:text-gray-300">{evaluation.extractedValue}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Source Document</p>
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
                <p className="text-sm text-navy-600 dark:text-navy-400 font-medium">{evaluation.sourceDocument}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Decision</p>
              <div className="flex items-center gap-2">
                {decisionIcon[evaluation.decision]}
                <StatusBadge status={evaluation.decision} />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Confidence Score</p>
              <ConfidenceIndicator value={evaluation.confidence} />
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-100 dark:border-gray-700 dark:border-gray-600">
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Reasoning</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 dark:text-gray-300 leading-relaxed">{evaluation.explanation}</p>
          </div>

          <div className="bg-navy-50 dark:bg-navy-900/20 rounded-lg p-4 border border-navy-100 dark:border-navy-800">
            <p className="text-[11px] font-medium text-navy-600 dark:text-navy-400 uppercase tracking-wider mb-2">Evaluation Method</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 dark:text-gray-300 leading-relaxed">
              This evaluation was performed using AI-powered document analysis. The system extracted the relevant
              data point from the submitted document, compared it against the tender criterion threshold, and
              generated a decision with confidence score based on document clarity, data completeness, and
              threshold margin.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 bg-white dark:bg-gray-800 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:bg-gray-700/50 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
