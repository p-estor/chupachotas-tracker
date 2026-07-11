import React from 'react';

export default function ThemeSwitcher({ currentTheme, setCurrentTheme }) {
  const themes = [
    { value: 'broadcast', label: 'Broadcast' },
    { value: 'cyber-tactical', label: 'Cyber-Tactical' },
    { value: 'glass-brutalism', label: 'Glass Brutalism' },
    { value: 'data-dense', label: 'Data-Dense' },
    { value: 'split-contrast', label: 'Split Contrast' }
  ];

  const handleThemeChange = (newTheme) => {
    setCurrentTheme(newTheme);
    localStorage.setItem('chupachotas-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <div className="theme-switcher-container" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <label htmlFor="theme-select" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        TEMA:
      </label>
      <select
        id="theme-select"
        value={currentTheme || 'broadcast'}
        onChange={(e) => handleThemeChange(e.target.value)}
        style={{
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-normal)',
          borderRadius: '4px',
          padding: '0.35rem 0.6rem',
          fontSize: '0.8rem',
          fontWeight: 700,
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }}
      >
        {themes.map((t) => (
          <option key={t.value} value={t.value} style={{ background: '#12131a', color: '#fff' }}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
