import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import {
  LayoutDashboard,
  FileUp,
  Users,
  Brain,
  PieChart,
  FileText,
  UserCheck,
  Rocket,
  Sparkles,
  Radar,
  Workflow,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tender-upload', icon: FileUp, label: 'Tender Upload' },
  { to: '/bidder-upload', icon: Users, label: 'Bidder Submissions' },
  { to: '/evaluation', icon: Brain, label: 'AI Evaluation' },
  { to: '/decision-summary', icon: PieChart, label: 'Decision Summary' },
  { to: '/report', icon: FileText, label: 'Detailed Report' },
  { to: '/review', icon: UserCheck, label: 'Manual Review' },
];

const demoFeatures = [
  { to: '/smart-eligibility-radar', icon: Sparkles, label: 'Smart Eligibility Radar' },
  { to: '/risk-heatmap', icon: Radar, label: 'Risk Heatmap' },
  { to: '/workflow-preview', icon: Workflow, label: 'Auto Workflow Preview' },
];

export default function Sidebar() {
  const isDarkMode = useAppStore((state) => state.isDarkMode);

  return (
    <aside className={`fixed left-0 top-0 h-screen w-64 flex flex-col z-50 ${
      isDarkMode 
        ? 'bg-gray-900 text-white border-gray-800' 
        : 'bg-navy-900 text-white border-navy-800'
    }`}>
      <div className={`px-6 py-5 border-b ${isDarkMode ? 'border-gray-800' : 'border-navy-800'}`}>
        <div className="flex items-center gap-3">
          {/* <Shield className="w-8 h-8 text-gold-400" /> */}
          <div>
            <h1 className="text-base font-bold tracking-wide leading-tight flex items-center gap-1.5">
              ProcureRocket
              <Rocket className="w-6 h-6 text-gold-500" />
            </h1>
            <p className="text-[10px] text-navy-300 tracking-widest uppercase">AI Tender Intelligence</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? isDarkMode ? 'bg-gray-700 text-white shadow-sm' : 'bg-navy-700 text-white shadow-sm'
                  : isDarkMode ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-navy-200 hover:bg-navy-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-[18px] h-[18px]" />
            {item.label}
          </NavLink>
        ))}

        <div className={`pt-4 mt-4 space-y-1 border-t ${isDarkMode ? 'border-gray-800' : 'border-navy-800'}`}>
          {demoFeatures.map((feature) => (
            <NavLink
              key={feature.to}
              to={feature.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? isDarkMode ? 'bg-gray-700 text-white shadow-sm' : 'bg-navy-700 text-white shadow-sm'
                    : isDarkMode ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-navy-200 hover:bg-navy-800 hover:text-white'
                }`
              }
            >
              <feature.icon className="w-[18px] h-[18px]" />
              <span className="truncate">{feature.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className={`px-4 py-4 border-t ${isDarkMode ? 'border-gray-800' : 'border-navy-800'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
            isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-navy-600 text-white'
          }`}>
            AK
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Sh. A.K. Verma</p>
            <p className={`text-[11px] ${isDarkMode ? 'text-gray-400 dark:text-gray-500' : 'text-navy-400'}`}>Procurement Officer</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
