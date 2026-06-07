import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import Sidebar from './Sidebar';
import NotificationToast from '../common/NotificationToast';

export default function AppLayout() {
  const isDarkMode = useAppStore((state) => state.isDarkMode);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <main className="ml-64 min-h-screen">
        <Outlet />
      </main>
      <NotificationToast />
    </div>
  );
}
