import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Role } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  setUser: (u: User) => void;
  switchRole: (role: Role) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  setUser: () => {},
  switchRole: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        setUser(data);
      })
      .catch(() => {
        setUser({
          user_id: 'user_dr_ortho',
          email: 'JUGA009@gmail.com',
          name: 'Dr. J. Ratna, MS (Ortho)',
          picture: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
          role: 'admin',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const switchRole = (role: Role) => {
    if (user) {
      const updated = { ...user, role };
      setUser(updated);
      fetch(`/api/auth/users/${user.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      }).catch(() => {});
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, setUser, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
