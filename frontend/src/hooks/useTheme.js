import { useState, useEffect } from 'react';

const THEMES = {
  dark: {
    '--bg-primary': '#0D1117',
    '--bg-card': '#161B22',
    '--bg-sidebar': '#010409',
    '--border': '#30363D',
    '--text-primary': '#E6EDF3',
    '--text-secondary': '#7D8590',
    '--accent': '#2F81F7',
  },
  light: {
    '--bg-primary': '#FFFFFF',
    '--bg-card': '#F6F8FA',
    '--bg-sidebar': '#F6F8FA',
    '--border': '#D0D7DE',
    '--text-primary': '#1F2328',
    '--text-secondary': '#636C76',
    '--accent': '#0969DA',
  },
  industrial: {
    '--bg-primary': '#000000',
    '--bg-card': '#111111',
    '--bg-sidebar': '#000000',
    '--border': '#444444',
    '--text-primary': '#FFFFFF',
    '--text-secondary': '#CCCCCC',
    '--accent': '#FFD700',  // Gold — high visibility
  }
};

export function useTheme() {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('aiki-theme') || 'dark'
  );

  useEffect(() => {
    const vars = THEMES[theme] || THEMES.dark;
    Object.entries(vars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
    localStorage.setItem('aiki-theme', theme);
  }, [theme]);

  return { theme, setTheme, themes: Object.keys(THEMES) };
}
