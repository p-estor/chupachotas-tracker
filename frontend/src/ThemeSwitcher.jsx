import React, { useEffect, useState } from 'react';

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState('classic');

  useEffect(() => {
    const savedTheme = localStorage.getItem('chupachotas-theme') || 'classic';
    setTheme(savedTheme);
    if (savedTheme === 'pro' || savedTheme === 'broadcast') {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  const toggleTheme = () => {
    let newTheme = 'classic';
    if (theme === 'classic') newTheme = 'pro';
    else if (theme === 'pro') newTheme = 'broadcast';
    
    setTheme(newTheme);
    localStorage.setItem('chupachotas-theme', newTheme);
    
    if (newTheme === 'pro' || newTheme === 'broadcast') {
      document.documentElement.setAttribute('data-theme', newTheme);
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
        background: theme === 'pro' 
          ? 'var(--accent-cyan)' 
          : theme === 'broadcast' 
            ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))' 
            : 'transparent',
        color: theme === 'pro' ? '#000' : theme === 'broadcast' ? '#fff' : 'var(--text-primary)',
        border: `1px solid ${
          theme === 'pro' 
            ? 'var(--accent-cyan)' 
            : theme === 'broadcast' 
              ? 'transparent' 
              : 'var(--border-normal)'
        }`,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.35rem 0.85rem',
        borderRadius: '6px',
        fontWeight: 700,
        fontSize: '0.8rem',
        cursor: 'pointer',
        marginLeft: '0.5rem',
        transition: 'all 0.2s',
        boxShadow: theme === 'broadcast' ? '0 0 10px rgba(168, 85, 247, 0.3)' : 'none'
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
      {theme.toUpperCase()}
    </button>
  );
}
