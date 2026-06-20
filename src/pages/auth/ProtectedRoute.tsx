import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';

const getTokenPayload = (token: string) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  // ⛔ important : attendre la rehydration
  if (!hasHydrated) return null;

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const payload = getTokenPayload(token);

  if (!payload) {
    useAuthStore.getState().reset();
    return <Navigate to="/login" replace />;
  }

  if (payload.status === 'inactif') {
    return <Navigate to="/verify-email" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
