
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, setPersistence, browserLocalPersistence, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/router';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: async () => {} });
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 1. Forzar persistencia LOCAL (sobrevive al refresh)
    setPersistence(auth, browserLocalPersistence).catch(e => console.error("Error persistencia:", e));

    // 2. Escuchar cambios
    const unsub = onAuthStateChanged(auth, (u) => {
      console.log("Auth State:", u ? "LOGGED IN" : "LOGGED OUT");
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const logout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return <AuthContext.Provider value={{ user, loading, logout }}>{children}</AuthContext.Provider>;
};
