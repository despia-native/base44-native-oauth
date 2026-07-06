import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import * as customAuth from '@/lib/customAuth';
import { useFocusEvents } from '@/hooks/useFocusEvents';
import { linkPushUser } from '@/lib/push';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // Custom JWT auth — Base44 is used for storage/functions only (see base44Client).
  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    const account = await customAuth.fetchMe();
    if (account) {
      setUser(account);
      setIsAuthenticated(true);
      linkPushUser(account.id); // link this device to the user for push targeting
    } else {
      setUser(null);
      setIsAuthenticated(false);
    }
    setIsLoadingAuth(false);
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    // Reference kept so the platform-managed base44 client stays imported/initialized.
    void base44;
    checkUserAuth();
  }, [checkUserAuth]);

  // Native app resume: silently revalidate the session (no loading flash) so a
  // token expired while backgrounded is caught the moment the user returns.
  useFocusEvents({
    onFocus: async () => {
      const account = await customAuth.fetchMe();
      setUser(account || null);
      setIsAuthenticated(!!account);
    },
  });

  // SPA logout — no hard redirect: clearing the auth state makes ProtectedRoute
  // render <Navigate to="/login" /> on its own, without reloading the page.
  const logout = () => {
    customAuth.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authChecked,
      logout,
      checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};