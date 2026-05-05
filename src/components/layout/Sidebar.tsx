import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileUp,
  Users,
  Brain,
  PieChart,
  FileText,
  UserCheck,
  Shield,
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

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-navy-900 text-white flex flex-col z-50">
      <div className="px-6 py-5 border-b border-navy-800">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-gold-400" />
          <div>
            <h1 className="text-base font-bold tracking-wide leading-tight">TenderEval</h1>
            <p className="text-[10px] text-navy-300 tracking-widest uppercase">AI-Powered System</p>
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
                  ? 'bg-navy-700 text-white shadow-sm'
                  : 'text-navy-200 hover:bg-navy-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-[18px] h-[18px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-navy-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-navy-600 flex items-center justify-center text-xs font-bold">
            AK
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Sh. A.K. Verma</p>
            <p className="text-[11px] text-navy-400">Procurement Officer</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
