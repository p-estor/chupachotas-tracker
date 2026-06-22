import React, { useEffect, useState } from 'react';

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState('classic');

  useEffect(() => {
    const savedTheme = localStorage.getItem('chupachotas-theme') || 'classic';
    setTheme(savedTheme);
    if (savedTheme === 'pro') {
      document.documentElement.setAttribute('data-theme', 'pro');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'classic' ? 'pro' : 'classic';
    setTheme(newTheme);
    localStorage.setItem('chupachotas-theme', newTheme);
    
    if (newTheme === 'pro') {
      document.documentElement.setAttribute('data-theme', 'pro');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  return (
    <button 
      onClick={toggleTheme}
      className="nav-link"
      title={`Modo actual: ${theme.toUpperCase()}`}
      style={{
        background: theme === 'pro' ? 'var(--accent-cyan)' : 'transparent',
        color: theme === 'pro' ? '#000' : 'var(--text-primary)',
        border: `1px solid ${theme === 'pro' ? 'var(--accent-cyan)' : 'var(--border-normal)'}`,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.35rem 0.85rem',
        borderRadius: '6px',
        fontWeight: 600,
        fontSize: '0.8rem',
        cursor: 'pointer',
        marginLeft: '0.5rem',
        transition: 'all 0.2s'
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
      {theme === 'pro' ? 'PRO' : 'CLASSIC'}
    </button>
  );
}
