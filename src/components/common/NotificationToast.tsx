import { useEffect, useState } from 'react';
import { X, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface Toast {
  id: string;
  type: 'error' | 'success' | 'info';
  message: string;
}

let toastQueue: Toast[] = [];
let toastListeners: ((toasts: Toast[]) => void)[] = [];

export function showToast(type: Toast['type'], message: string) {
  const toast: Toast = { id: `t${Date.now()}`, type, message };
  toastQueue = [toast, ...toastQueue].slice(0, 3);
  toastListeners.forEach((l) => l([...toastQueue]));
}

function dismissToast(id: string) {
  toastQueue = toastQueue.filter((t) => t.id !== id);
  toastListeners.forEach((l) => l([...toastQueue]));
}

export default function NotificationToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { error, setError } = useAppStore();

  useEffect(() => {
    toastListeners.push(setToasts);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== setToasts);
    };
  }, []);

  // Sync store error to toast
  useEffect(() => {
    if (error) {
      showToast('error', error);
      setError(null);
    }
  }, [error, setError]);

  // Auto-dismiss after 5s
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      dismissToast(toasts[toasts.length - 1].id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toasts]);

  if (toasts.length === 0) return null;

  const iconMap = {
    error: <AlertTriangle className="w-4 h-4 text-red-500" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    info: <Info className="w-4 h-4 text-blue-500" />,
  };

  const bgMap = {
    error: 'bg-red-50 border-red-200',
    success: 'bg-emerald-50 border-emerald-200',
    info: 'bg-blue-50 border-blue-200',
  };

  const textMap = {
    error: 'text-red-800',
    success: 'text-emerald-800',
    info: 'text-blue-800',
  };

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg animate-slide-in ${bgMap[toast.type]}`}
        >
          <div className="flex-shrink-0 mt-0.5">{iconMap[toast.type]}</div>
          <p className={`text-sm font-medium flex-1 ${textMap[toast.type]}`}>{toast.message}</p>
          <button
            onClick={() => dismissToast(toast.id)}
            className="flex-shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      ))}
    </div>
  );
}
