import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export function normalizeRole(role) {
  if (!role) return 'applicant';
  const r = String(role).toLowerCase().trim();
  if (r.includes('lender')) return 'lender';
  if (r.includes('admin')) return 'admin';
  return 'applicant';
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('credchain_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.role) {
          parsed.role = normalizeRole(parsed.role);
        }
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('credchain_token') || null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function verifyAuth() {
      const storedToken = localStorage.getItem('credchain_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/me');
        if (response && response.user) {
          const sanitizedUser = {
            ...response.user,
            role: normalizeRole(response.user.role),
          };
          setUser(sanitizedUser);
          localStorage.setItem('credchain_user', JSON.stringify(sanitizedUser));
        }
      } catch (err) {
        console.warn('Backend /auth/me not available or expired token:', err.message);
        if (err.status === 401) {
          setUser(null);
          setToken(null);
          localStorage.removeItem('credchain_token');
          localStorage.removeItem('credchain_user');
        }
      } finally {
        setIsLoading(false);
      }
    }

    verifyAuth();

    const handleAuthChange = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('credchain_auth_change', handleAuthChange);
    return () => window.removeEventListener('credchain_auth_change', handleAuthChange);
  }, []);

  const login = async (email, password, selectedRole) => {
    setIsLoading(true);
    const standardRole = normalizeRole(selectedRole);

    try {
      // Attempt backend authentication
      const res = await api.post('/auth/login', {
        email,
        password,
        role: standardRole,
      });

      if (res && res.token && res.user) {
        const cleanUser = {
          ...res.user,
          role: normalizeRole(res.user.role || standardRole),
        };
        api.setToken(res.token);
        setToken(res.token);
        setUser(cleanUser);
        localStorage.setItem('credchain_user', JSON.stringify(cleanUser));
        return { success: true, user: cleanUser };
      }
      throw new Error('Invalid response from server');
    } catch (err) {
      if (err.status) {
        throw err;
      }
      console.warn('API login network error:', err.message);
      throw new Error(err.message || 'Unable to reach CredChain API server. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/register', userData);
      if (res && res.token && res.user) {
        const cleanUser = {
          ...res.user,
          role: normalizeRole(res.user.role || 'applicant'),
        };
        api.setToken(res.token);
        setToken(res.token);
        setUser(cleanUser);
        localStorage.setItem('credchain_user', JSON.stringify(cleanUser));
        return { success: true, user: cleanUser };
      }
      return { success: true, message: res?.message || 'Registration successful' };
    } catch (err) {
      if (err.status) {
        throw err;
      }
      console.warn('API registration network error:', err.message);
      throw new Error(err.message || 'Unable to reach CredChain API server. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // Ignore network errors on logout
    } finally {
      api.setToken(null);
      setToken(null);
      setUser(null);
      localStorage.removeItem('credchain_user');
      localStorage.removeItem('credchain_token');
    }
  };

  const currentRole = normalizeRole(user?.role);
  const displayRole = currentRole === 'lender' ? 'Lender' : currentRole === 'admin' ? 'Admin' : 'Applicant';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: displayRole,
        rawRole: currentRole,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
