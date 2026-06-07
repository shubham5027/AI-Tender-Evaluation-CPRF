import { Loader2 } from 'lucide-react';

export default function PageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-navy-600 animate-spin mb-3" />
      <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{message}</p>
    </div>
  );
}
