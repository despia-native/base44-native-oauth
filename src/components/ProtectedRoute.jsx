import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const DefaultFallback = () => (
  <div role="status" className="fixed inset-0 flex items-center justify-center bg-background">
    <div aria-hidden="true" className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin"></div>
    <span className="sr-only">Loading…</span>
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked } = useAuth();

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  return <Outlet />;
}