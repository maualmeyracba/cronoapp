import React, { createContext, useContext, useEffect, useState } from 'react';

export type TTheme = 'enterprise' | 'tactical' | 'modern';

interface ThemeProps {
  theme: TTheme;
  setTheme: (t: TTheme) => void;
}

const ThemeContext = createContext<ThemeProps | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<TTheme>('enterprise');

  useEffect(() => {
    const saved = localStorage.getItem('cronoapp-theme') as TTheme;
    if (saved) setTheme(saved); console.log("DEBUG-CONTEXT: Tema cargado de storage", saved);
  }, []);

  useEffect(() => {
    const rootEl = document.documentElement;
    rootEl.setAttribute('data-theme', theme);
    localStorage.setItem('cronoapp-theme', theme); console.log("DEBUG-CONTEXT: Tema aplicado al HTML", theme);
    console.log("CronoApp Theme Switch ->", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) return { theme: 'enterprise' as TTheme, setTheme: () => {} };
  return context;
};
