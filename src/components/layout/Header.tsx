import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, LogOut, Search, UserCircle2 } from 'lucide-react';
import { showToast } from '../common/NotificationToast';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 'n1', text: 'Tender CRPF-2026-001 uploaded successfully.', read: false, at: '2m ago' },
    { id: 'n2', text: 'AI evaluation completed for Metro Surveillance RFP.', read: false, at: '8m ago' },
    { id: 'n3', text: '3 review flags need manual validation.', read: true, at: '15m ago' },
  ]);
  const [demoUser, setDemoUser] = useState<{ name: string; role: string } | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const userRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('demo-user');
    if (raw) {
      try {
        setDemoUser(JSON.parse(raw) as { name: string; role: string });
      } catch {
        setDemoUser(null);
      }
    }
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) setIsNotifOpen(false);
      if (userRef.current && !userRef.current.contains(target)) setIsUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  const signInDemo = () => {
    const user = { name: 'Sh. A.K. Verma', role: 'Procurement Officer' };
    setDemoUser(user);
    localStorage.setItem('demo-user', JSON.stringify(user));
    setIsUserMenuOpen(false);
    showToast('success', 'User signed in.');
  };

  const signOutDemo = () => {
    setDemoUser(null);
    localStorage.removeItem('demo-user');
    setIsUserMenuOpen(false);
    showToast('info', 'Signed out from user.');
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-40">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenders, bidders..."
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent bg-gray-50"
          />
        </div>

        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen((prev) => !prev)}
            className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
          </button>
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Notifications</p>
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-navy-600 hover:text-navy-700 font-medium"
                >
                  Mark all read
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setNotifications((prev) =>
                        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
                      );
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${
                      item.read ? 'bg-white' : 'bg-navy-50/40'
                    }`}
                  >
                    <p className="text-sm text-gray-800">{item.text}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{item.at}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={userRef}>
          <button
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="User menu"
          >
            <div className="w-8 h-8 rounded-full bg-navy-100 text-navy-700 flex items-center justify-center text-xs font-semibold">
              {demoUser ? 'AK' : <UserCircle2 className="w-5 h-5" />}
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-gray-800 leading-tight">{demoUser ? demoUser.name : 'Guest User'}</p>
              <p className="text-[11px] text-gray-500 leading-tight">{demoUser ? demoUser.role : 'Not signed in'}</p>
            </div>
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-2">
              {demoUser ? (
                <button
                  onClick={signOutDemo}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              ) : (
                <button
                  onClick={signInDemo}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white bg-navy-600 hover:bg-navy-700 transition-colors"
                >
                  Sign in as Officer
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
