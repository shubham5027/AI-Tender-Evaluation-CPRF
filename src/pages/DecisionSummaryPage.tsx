import { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Play, Loader2 } from 'lucide-react';
import Header from '../components/layout/Header';
import { useAppStore } from '../store/useAppStore';

const COLORS: Record<string, string> = {
  'Eligible': '#059669',
  'Not Eligible': '#DC2626',
  'Review': '#D97706',
};

export default function DecisionSummaryPage() {
  const { getSelectedTender, runEvaluation, selectedTenderId, isParsing, useMockData } = useAppStore();
  const tender = getSelectedTender();
  const [filterBidder, setFilterBidder] = useState<string>('all');
  const [filterCriteria, setFilterCriteria] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (tender && !useMockData && tender.evaluations.length === 0 && tender.bidders.length > 0) {
      // Auto-refresh if evaluation might be in progress
    }
  }, [tender?.id]);

  const evaluations = tender?.evaluations || [];
  const bidders = tender?.bidders || [];
  const criteria = tender?.criteria || [];

  const filtered = useMemo(() => evaluations.filter((e) => {
    if (filterBidder !== 'all' && e.bidderId !== filterBidder) return false;
    if (filterCriteria !== 'all' && e.criterionId !== filterCriteria) return false;
    if (filterStatus !== 'all' && e.decision !== filterStatus) return false;
    return true;
  }), [evaluations, filterBidder, filterCriteria, filterStatus]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = { 'Eligible': 0, 'Not Eligible': 0, 'Review': 0 };
    filtered.forEach((e) => { counts[e.decision] = (counts[e.decision] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const bidderBarData = useMemo(() => {
    return bidders.map((b) => {
      const bidderEvals = filtered.filter((e) => e.bidderId === b.id);
      return {
        name: b.name.length > 20 ? b.name.substring(0, 20) + '...' : b.name,
        Eligible: bidderEvals.filter((e) => e.decision === 'Eligible').length,
        'Not Eligible': bidderEvals.filter((e) => e.decision === 'Not Eligible').length,
        Review: bidderEvals.filter((e) => e.decision === 'Review').length,
      };
    });
  }, [bidders, filtered]);

  const needsReviewItems = filtered.filter((e) => e.decision === 'Review');

  // Empty state when no evaluations exist yet
  if (evaluations.length === 0 && !isParsing) {
    return (
      <div>
        <Header title="Decision Summary" subtitle="Overview of evaluation decisions across all bidders" />
        <div className="p-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            {bidders.length === 0 ? (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-2">No bidders uploaded yet.</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Upload bidder documents first, then run the AI evaluation.</p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-4">{bidders.length} bidder(s) ready for evaluation.</p>
                <button
                  onClick={() => selectedTenderId && runEvaluation(selectedTenderId)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy-600 text-white text-sm font-medium rounded-lg hover:bg-navy-700 transition-colors"
                >
                  <Play className="w-4 h-4" /> Run AI Evaluation
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Decision Summary" subtitle="Overview of evaluation decisions across all bidders" />
      <div className="p-8">
        {isParsing && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800">AI evaluation in progress...</p>
              <p className="text-xs text-blue-600 mt-0.5">Analyzing bidder documents against eligibility criteria.</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <select
            value={filterBidder}
            onChange={(e) => setFilterBidder(e.target.value)}
            className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500 bg-white dark:bg-gray-800"
          >
            <option value="all">All Bidders</option>
            {bidders.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select
            value={filterCriteria}
            onChange={(e) => setFilterCriteria(e.target.value)}
            className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500 bg-white dark:bg-gray-800"
          >
            <option value="all">All Criteria</option>
            {criteria.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500 bg-white dark:bg-gray-800"
          >
            <option value="all">All Statuses</option>
            <option value="Eligible">Eligible</option>
            <option value="Not Eligible">Not Eligible</option>
            <option value="Review">Needs Review</option>
          </select>
          {selectedTenderId && (
            <button
              onClick={() => runEvaluation(selectedTenderId)}
              disabled={isParsing}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-navy-600 text-white text-xs font-medium rounded-lg hover:bg-navy-700 transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" /> Re-evaluate
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Decision Distribution</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#6B7280'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Decisions by Bidder</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={bidderBarData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Eligible" stackId="a" fill={COLORS['Eligible']} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Not Eligible" stackId="a" fill={COLORS['Not Eligible']} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Review" stackId="a" fill={COLORS['Review']} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {needsReviewItems.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-amber-50 dark:bg-amber-900/200 animate-pulse" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Needs Manual Review</h3>
              <span className="text-xs text-amber-600 font-medium">({needsReviewItems.length} items)</span>
            </div>
            <div className="space-y-2">
              {needsReviewItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.bidderName}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{item.criterionName}: {item.extractedValue}</p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 flex-shrink-0 ml-4">
                    Review
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
