import { Navigate, useLocation } from 'react-router-dom'

// Unauthenticated visit to a protected page → go to login, remembering where
// the user was headed so Login/EmailLogin can return them there after sign-in.
export default function RedirectToLogin() {
  const location = useLocation()
  return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
}