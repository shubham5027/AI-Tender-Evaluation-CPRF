import { useEffect } from 'react';
import { FileText, Brain, CheckCircle, AlertTriangle, Clock, ArrowRight, Plus, Loader2, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import { useAppStore } from '../store/useAppStore';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { tenders, activityLog, fetchTenders, isLoading, useMockData, setSelectedTender, seedDatabase } = useAppStore();

  useEffect(() => {
    if (useMockData) {
      fetchTenders();
    }
  }, []);

  const totalTenders = tenders.length;
  const activeEvals = tenders.filter((t) => t.status === 'Evaluating').length;
  const allEvals = tenders.flatMap((t) => t.evaluations);
  const eligibleBidders = new Set(
    allEvals.filter((e) => e.decision === 'Eligible').map((e) => e.bidderId)
  ).size;
  const needsReview = allEvals.filter((e) => e.decision === 'Review').length;

  const cards = [
    { label: 'Total Tenders Processed', value: totalTenders, icon: FileText, color: 'bg-navy-600', textColor: 'text-navy-600' },
    { label: 'Active Evaluations', value: activeEvals, icon: Brain, color: 'bg-blue-600', textColor: 'text-blue-600' },
    { label: 'Eligible Bidders', value: eligibleBidders, icon: CheckCircle, color: 'bg-emerald-600', textColor: 'text-emerald-600' },
    { label: 'Needs Review Cases', value: needsReview, icon: AlertTriangle, color: 'bg-amber-600', textColor: 'text-amber-600' },
  ];

  const handleTenderClick = (tenderId: string) => {
    setSelectedTender(tenderId);
    navigate('/evaluation');
  };

  return (
    <div>
      <Header title="Dashboard" subtitle="Tender Evaluation System — CRPF Procurement Division" />
      <div className="p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {cards.map((card) => (
            <div key={card.label} className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 p-5 hover:shadow-md dark:hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 mt-2">
                    {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" /> : card.value}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-lg ${card.color} bg-opacity-10 dark:bg-opacity-20 flex items-center justify-center`}>
                  <card.icon className={`w-5 h-5 ${card.textColor}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Recent Activity</h2>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{activityLog.length} entries</span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {activityLog.slice(0, 8).map((log) => (
                <div key={log.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-gray-50 dark:bg-gray-700/50 dark:hover:bg-gray-700 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-navy-50 dark:bg-navy-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-navy-600 dark:text-navy-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{log.action}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">{log.details}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{log.user}</span>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                        {new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                      {log.tenderRef && (
                        <span className="text-[11px] text-navy-600 dark:text-navy-400 font-medium">{log.tenderRef}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {activityLog.length === 0 && (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">No activity yet. Create a tender to get started.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Active Tenders</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={seedDatabase}
                  disabled={isLoading}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-gray-800 dark:bg-gray-700 text-navy-600 dark:text-navy-400 text-xs font-medium rounded-lg border border-navy-200 dark:border-navy-800 hover:bg-navy-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                  title="Load demo data"
                >
                  <Database className="w-3 h-3" /> Seed Demo
                </button>
                <button
                  onClick={() => navigate('/tender-upload')}
                  className="flex items-center gap-1 px-2.5 py-1 bg-navy-600 text-white text-xs font-medium rounded-lg hover:bg-navy-700 dark:hover:bg-navy-500 transition-colors"
                >
                  <Plus className="w-3 h-3" /> New
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {tenders.map((tender) => (
                <button
                  key={tender.id}
                  onClick={() => handleTenderClick(tender.id)}
                  className="w-full px-5 py-4 text-left hover:bg-gray-50 dark:bg-gray-700/50 dark:hover:bg-gray-700 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100 truncate">{tender.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">{tender.referenceNo}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          tender.status === 'Completed'
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : tender.status === 'Evaluating'
                            ? 'bg-blue-50 dark:bg-blue-900/20 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : tender.status === 'Parsed'
                            ? 'bg-amber-50 dark:bg-amber-900/20 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 dark:text-gray-500'
                        }`}>
                          {tender.status}
                        </span>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                          {tender.bidders.length} bidders
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-navy-600 dark:group-hover:text-navy-400 transition-colors mt-1" />
                  </div>
                </button>
              ))}
              {tenders.length === 0 && !isLoading && (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">No tenders yet.</p>
                  <button
                    onClick={() => navigate('/tender-upload')}
                    className="mt-2 text-xs text-navy-600 dark:text-navy-400 font-medium hover:underline"
                  >
                    Create your first tender
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
