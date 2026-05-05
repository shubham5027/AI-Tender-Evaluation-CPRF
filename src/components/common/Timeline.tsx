import { Check, Clock, Loader2 } from 'lucide-react';
import type { TimelineStep } from '../../types';

export default function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  step.status === 'completed'
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : step.status === 'current'
                    ? 'bg-navy-600 border-navy-600 text-white'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {step.status === 'completed' ? (
                  <Check className="w-4 h-4" />
                ) : step.status === 'current' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
              </div>
              <p className={`text-[10px] font-medium mt-1.5 text-center max-w-[80px] ${
                step.status === 'pending' ? 'text-gray-400' : 'text-gray-700'
              }`}>
                {step.label}
              </p>
              {step.timestamp && (
                <p className="text-[9px] text-gray-400 mt-0.5">{step.timestamp}</p>
              )}
            </div>
            {!isLast && (
              <div
                className={`w-12 h-0.5 mx-1 mb-6 ${
                  step.status === 'completed' ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
