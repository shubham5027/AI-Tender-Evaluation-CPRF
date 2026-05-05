import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationToast from '../common/NotificationToast';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 min-h-screen">
        <Outlet />
      </main>
      <NotificationToast />
    </div>
  );
}
