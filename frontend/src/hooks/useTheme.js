import { useState, useEffect } from 'react';

const THEMES = {
  dark: {
    '--bg-primary': '#181816',
    '--bg-card': '#22221f',
    '--bg-sidebar': '#121211',
    '--border': '#32322e',
    '--text-primary': '#ecebe6',
    '--text-secondary': '#a6a49c',
    '--text-muted': '#787670',
    '--accent-blue': '#d97756',
    '--accent-green': '#84a98c',
    '--accent-amber': '#e0a96d',
    '--accent-red': '#e07a5f',
    '--accent-purple': '#b8a1cf',
  },
  light: {
    '--bg-primary': '#fcfbf9',
    '--bg-card': '#ffffff',
    '--bg-sidebar': '#f6f5f2',
    '--border': '#e6e4df',
    '--text-primary': '#222220',
    '--text-secondary': '#6b6964',
    '--text-muted': '#9a9893',
    '--accent-blue': '#c96f53',
    '--accent-green': '#608066',
    '--accent-amber': '#bfa15f',
    '--accent-red': '#bf5a43',
    '--accent-purple': '#8d6e9e',
  },
  industrial: {
    '--bg-primary': '#000000',
    '--bg-card': '#111111',
    '--bg-sidebar': '#000000',
    '--border': '#444444',
    '--text-primary': '#FFFFFF',
    '--text-secondary': '#CCCCCC',
    '--text-muted': '#888888',
    '--accent-blue': '#FFD700',
    '--accent-green': '#00FF00',
    '--accent-amber': '#FF8C00',
    '--accent-red': '#FF0000',
    '--accent-purple': '#DA70D6',
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

