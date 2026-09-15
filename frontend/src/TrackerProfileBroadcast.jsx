import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DDRAGON_VERSION } from './constants';

export default function TrackerProfileBroadcast({
  summoner,
  matches,
  statsMatches,
  getChampIcon,
  getPerformanceLabel,
  getMatchPerformanceData,
  activeTab,
  setActiveTab,
  expandedMatchId,
  setExpandedMatchId,
  groupedMatches,
  queueFilter,
  setQueueFilter,
  getSidebarChampionStats,
  renderChampionsTab,
  renderAramTab,
  renderTeamTable,
  renderHistorySummary,
  getRankBadgeColor,
  getRankBadgeIcon,
  formatDuration,
  getQueueDisplayName,
  getItemIcon,
  getRuneIcon,
  getSpellIcon,
  loadingStatsMatches,
  renderLiveTab,
}) {
  const { t } = useTranslation();

  if (!summoner) return null;

  const totalMatches = matches?.length || 0;
  const wins = matches?.filter(m => {
    const p = m.participants?.find(part => part.puuid === summoner.puuid);
    return p?.win;
  }).length || 0;
  const losses = totalMatches - wins;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  // Calculate most played champion from the matches list to show as header splash background (Option A)
  const getMostPlayedChamp = () => {
    if (!matches || matches.length === 0) return null;
    const counts = {};
    matches.forEach(m => {
      const p = m.participants?.find(part => part.puuid === summoner.puuid);
      const champ = m.playerStats?.championName ?? p?.championName;
      if (champ) counts[champ] = (counts[champ] || 0) + 1;
    });
    let maxChamp = null;
    let maxCount = -1;
    Object.keys(counts).forEach(champ => {
      if (counts[champ] > maxCount) {
        maxCount = counts[champ];
        maxChamp = champ;
      }
    });
    return maxChamp;
  };

  const mostPlayedChamp = getMostPlayedChamp();
  const headerSplashUrl = mostPlayedChamp 
    ? `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${mostPlayedChamp}_0.jpg`
    : null;

  // State to hold user-selected champion for featured details card (TFTAcademy style)
  const [selectedChampName, setSelectedChampName] = useState(null);
  const [sidebarActive, setSidebarActive] = useState(false);

  // ponytail: no metrics complex filters, simplified overview panel logic
  return (
    <div className="broadcast-container">
      {/* Floating Mobile Toggle Button */}
      <button 
        className="broadcast-sidebar-toggle-btn"
        onClick={() => setSidebarActive(true)}
      >
        <span>🔍</span> Mostrar Filtros y Rangos
      </button>

      {/* Mobile Drawer Overlay */}
      {sidebarActive && (
        <div 
          className="broadcast-sidebar-overlay"
          onClick={() => setSidebarActive(false)}
        />
      )}
      {/* HEADER: Cinematic Broadcast HUD */}
      <header className="broadcast-header" style={{ position: 'relative', overflow: 'hidden' }}>
        {headerSplashUrl && (
          <div 
            className="broadcast-header-splash-bg"
            style={{ 
              backgroundImage: `url(${headerSplashUrl})`
            }} 
          />
        )}
        <div className="broadcast-header-profile" style={{ position: 'relative', zIndex: 2 }}>
          <div className="broadcast-avatar-glow-wrapper">
            <img 
              src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${summoner.profileIconId}.png`} 
              alt="Profile Icon" 
              className="broadcast-avatar-img"
            />
          </div>
          <div className="broadcast-profile-details">
            <h1 className="broadcast-summoner-name" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {summoner.gameName}<span className="broadcast-tag">#{summoner.tagLine}</span>
            </h1>
            <div className="broadcast-level-pill">
              NIVEL {summoner.summonerLevel}
            </div>
          </div>
        </div>

        <div className="broadcast-header-summary" style={{ position: 'relative', zIndex: 2 }}>
          <div className="broadcast-summary-metric">
            <span className="metric-label">HISTORIAL RECIENTE</span>
            <span className="metric-value winrate-color-trigger" style={{ color: winRate >= 50 ? 'var(--win-color)' : 'var(--loss-color)' }}>
              {winRate}% WR
            </span>
            <span className="metric-sub">{wins}W - {losses}L</span>
          </div>
        </div>
      </header>

      {/* BROADCAST TABS */}
      <nav className="broadcast-nav">
        {[
          { id: 'overview', label: 'Resumen' },
          { id: 'champions', label: 'Campeones' },
          { id: 'aram', label: 'ARAM' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`broadcast-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <div className="broadcast-overview-wrapper">
          {/* TFTAcademy style selection bar */}
          {!loadingStatsMatches && getSidebarChampionStats().length > 0 && (() => {
            const topChamps = getSidebarChampionStats().slice(0, 8);
            const activeChamp = topChamps.find(c => c.name === (selectedChampName || topChamps[0].name)) || topChamps[0];
            const activeSplashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${activeChamp.name}_0.jpg`;
            
            return (
              <div className="tft-academy-container">
                {/* Horizontal selector row */}
                <div className="tft-selector-row">
                  {topChamps.map(c => (
                    <div 
                      key={c.name} 
                      className={`tft-selector-item ${activeChamp.name === c.name ? 'active' : ''}`}
                      onClick={() => setSelectedChampName(c.name)}
                      tabIndex="0"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedChampName(c.name);
                        }
                      }}
                    >
                      <div className="tft-avatar-glow">
                        <img src={getChampIcon(c.name)} alt={c.name} className="tft-selector-avatar" />
                      </div>
                      <span className="tft-selector-name">{c.name}</span>
                    </div>
                  ))}
                </div>

                {/* Big Details Panel with desaturated/fade background splash */}
                <div className="tft-showcase-panel">
                  <div 
                    className="tft-showcase-splash-bg"
                    style={{ backgroundImage: `url(${activeSplashUrl})` }}
                  />
                  <div className="tft-showcase-content">
                    <div className="tft-showcase-info">
                      <h2 className="tft-showcase-champ-name">{activeChamp.name.toUpperCase()}</h2>
                      <span className="tft-showcase-title">CAMPEÓN INSIGNIA</span>

                      <div className="tft-stats-grid">
                        <div className="tft-stat-box">
                          <span className="tft-stat-label">PARTIDAS JUGADAS</span>
                          <span className="tft-stat-value mono">{activeChamp.games}</span>
                        </div>
                        <div className="tft-stat-box">
                          <span className="tft-stat-label">PROMEDIO KDA</span>
                          <span className="tft-stat-value mono">{activeChamp.kdaRatio}</span>
                        </div>
                        <div className="tft-stat-box">
                          <span className="tft-stat-label">TASA DE VICTORIAS</span>
                          <span className="tft-stat-value mono" style={{ color: activeChamp.wr >= 55 ? 'var(--win-color)' : activeChamp.wr >= 48 ? '#fff' : 'var(--loss-color)' }}>
                            {activeChamp.wr}%
                          </span>
                        </div>
                        <div className="tft-stat-box">
                          <span className="tft-stat-label">FARMEO MINUTO</span>
                          <span className="tft-stat-value mono">{activeChamp.csMin} <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>CS/m</span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="broadcast-grid">
          {/* SIDEBAR */}
          <aside className={`broadcast-sidebar ${sidebarActive ? 'active' : ''}`}>
            <div className="broadcast-sidebar-mobile-header">
              <span>Filtros y Rangos</span>
              <button 
                className="broadcast-sidebar-close-btn" 
                onClick={() => setSidebarActive(false)}
                aria-label="Cerrar"
              >
                &times;
              </button>
            </div>
            {/* SOLOQ CARD */}
            {summoner.ranks?.solo && (
              <div className="broadcast-card broadcast-rank-card" style={{ '--rank-glow-color': getRankBadgeColor(summoner.ranks.solo.tier) }}>
                <div className="broadcast-rank-header">Ranked Solo</div>
                <div className="broadcast-rank-body-with-icon">
                  <img 
                    src={getRankBadgeIcon(summoner.ranks.solo.tier)} 
                    alt={summoner.ranks.solo.tier} 
                    className="broadcast-rank-badge-img" 
                  />
                  <div className="broadcast-rank-body">
                    <div className="broadcast-rank-main">
                      <span className="broadcast-rank-tier" style={{ color: getRankBadgeColor(summoner.ranks.solo.tier) }}>
                        {summoner.ranks.solo.tier} {summoner.ranks.solo.rank}
                      </span>
                      <span className="broadcast-rank-lp mono">{summoner.ranks.solo.leaguePoints} LP</span>
                    </div>
                    <div className="broadcast-rank-wl mono">
                      <span style={{ color: 'var(--win-color)' }}>{summoner.ranks.solo.wins}W</span>
                      <span> / </span>
                      <span style={{ color: 'var(--loss-color)' }}>{summoner.ranks.solo.losses}L</span>
                      <span className="muted-ratio"> ({summoner.ranks.solo.winRate}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FLEXQ CARD */}
            {summoner.ranks?.flex && (
              <div className="broadcast-card broadcast-rank-card" style={{ '--rank-glow-color': getRankBadgeColor(summoner.ranks.flex.tier) }}>
                <div className="broadcast-rank-header">Ranked Flex</div>
                <div className="broadcast-rank-body-with-icon">
                  <img 
                    src={getRankBadgeIcon(summoner.ranks.flex.tier)} 
                    alt={summoner.ranks.flex.tier} 
                    className="broadcast-rank-badge-img" 
                  />
                  <div className="broadcast-rank-body">
                    <div className="broadcast-rank-main">
                      <span className="broadcast-rank-tier" style={{ color: getRankBadgeColor(summoner.ranks.flex.tier) }}>
                        {summoner.ranks.flex.tier} {summoner.ranks.flex.rank}
                      </span>
                      <span className="broadcast-rank-lp mono">{summoner.ranks.flex.leaguePoints} LP</span>
                    </div>
                    <div className="broadcast-rank-wl mono">
                      <span style={{ color: 'var(--win-color)' }}>{summoner.ranks.flex.wins}W</span>
                      <span> / </span>
                      <span style={{ color: 'var(--loss-color)' }}>{summoner.ranks.flex.losses}L</span>
                      <span className="muted-ratio"> ({summoner.ranks.flex.winRate}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* QUEUE FILTERS */}
            <div className="broadcast-card broadcast-filter-card">
              <div className="broadcast-card-title">Filtro de Cola</div>
              <div className="broadcast-filters-grid">
                {[
                  { id: 'all', label: 'TODAS' },
                  { id: 'ranked_solo', label: 'SOLOQ' },
                  { id: 'ranked_flex', label: 'FLEX' },
                  { id: 'aram', label: 'ARAM' },
                  { id: 'normal', label: 'NORMAL' },
                ].map(f => (
                  <button
                    key={f.id}
                    className={`broadcast-filter-btn ${queueFilter === f.id ? 'active' : ''}`}
                    onClick={() => setQueueFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SIDEBAR CHAMPION PERFORMANCE */}
            <div className="broadcast-card broadcast-perf-card">
              <div className="broadcast-card-title">Campeones Destacados</div>
              {loadingStatsMatches ? (
                <div className="broadcast-loading-text">CARGANDO ESTADÍSTICAS...</div>
              ) : (
                <div className="broadcast-perf-list">
                  {getSidebarChampionStats().slice(0, 5).map(c => (
                    <div key={c.name} className="broadcast-perf-row">
                      <img src={getChampIcon(c.name)} alt={c.name} className="broadcast-perf-img" />
                      <div className="broadcast-perf-details">
                        <span className="broadcast-perf-name">{c.name}</span>
                        <span className="broadcast-perf-games mono">{c.games} {c.games === 1 ? 'partida' : 'partidas'}</span>
                      </div>
                      <div className="broadcast-perf-stats">
                        <span className="broadcast-perf-kda mono">{c.kdaRatio} KDA</span>
                        <span className={`broadcast-perf-wr mono ${c.wr >= 55 ? 'high' : c.wr >= 48 ? 'med' : 'low'}`}>
                          {c.wr}% WR
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* MAIN MATCH LOG */}
          <main className="broadcast-main">
            {renderHistorySummary && renderHistorySummary(matches)}

            <div className="broadcast-match-list">
              {!matches || matches.length === 0 ? (
                <div style={{
                  padding: '3rem',
                  textAlign: 'center',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-normal)',
                  borderRadius: '4px',
                  color: 'var(--text-muted)'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎮</div>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No se encontraron partidas</h3>
                  <p style={{ fontSize: '0.85rem' }}>Este invocador no tiene partidas recientes en la cola seleccionada.</p>
                </div>
              ) : (
                matches.map(match => {
                const participant = match.participants?.find(p => p.puuid === summoner.puuid);
                if (!participant) return null;

                const isWin = match.playerStats?.win ?? participant.win;
                const kills = match.playerStats?.kills ?? participant.kills;
                const deaths = match.playerStats?.deaths ?? participant.deaths;
                const assists = match.playerStats?.assists ?? participant.assists;
                const kda = deaths > 0 ? ((kills + assists) / deaths).toFixed(2) : 'Perfect';
                const cs = match.playerStats?.cs ?? (participant.totalMinionsKilled + participant.neutralMinionsKilled);
                const csMin = match.playerStats?.csPerMin ?? '-';
                const kp = match.playerStats?.killParticipation ?? '-';
                const champName = match.playerStats?.championName ?? participant.championName;
                const isExpanded = expandedMatchId === match.matchId;

                const ratings = getMatchPerformanceData ? getMatchPerformanceData(match) : {};
                const ratingObj = getPerformanceLabel(match, summoner.puuid, ratings);
                const isMvp = ratingObj.key === 'mvp';
                const isAce = ratingObj.key === 'ace';

                // DDragon Loading screen cut URL for background mask (optimized, lightweight fallback)
                const champSplashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champName}_0.jpg`;

                return (
                  <div 
                    key={match.matchId}
                    className={`broadcast-match-card ${isWin ? 'win' : 'loss'} ${isExpanded ? 'expanded' : ''} ${isMvp ? 'mvp-glow' : ''} ${isAce ? 'ace-glow' : ''}`}
                    onClick={() => setExpandedMatchId(isExpanded ? null : match.matchId)}
                    tabIndex="0"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedMatchId(isExpanded ? null : match.matchId);
                      }
                    }}
                  >
                    <span className={`broadcast-daltonism-indicator ${isWin ? 'win' : 'loss'}`} style={{
                      position: 'absolute',
                      left: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '0.7rem',
                      fontWeight: '800',
                      zIndex: 5,
                      pointerEvents: 'none',
                      color: isWin ? 'var(--win-color)' : 'var(--loss-color)',
                    }}>
                      {isWin ? '▲' : '▼'}
                    </span>
                    {/* Splash Art Background Mask */}
                    <div 
                      className="broadcast-match-splash-bg" 
                      style={{ backgroundImage: `url(${champSplashUrl})` }}
                    />

                    {/* Content Layer */}
                    <div className="broadcast-match-content">
                      {/* Left Block: Game Type & Result */}
                      <div className="broadcast-match-meta">
                        <span className="broadcast-queue-name">{getQueueDisplayName(match)}</span>
                        <span className="broadcast-match-outcome">
                          {isWin ? 'VICTORIA' : 'DERROTA'}
                        </span>
                        <span className="broadcast-match-time mono">{formatDuration(match.gameDuration)}</span>
                      </div>

                      {/* Champion Block with Dynamic fading effect */}
                      <div className="broadcast-match-champ" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                        <img src={getChampIcon(champName)} alt={champName} className="broadcast-match-avatar" loading="lazy" />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <span className="broadcast-match-champ-name">{champName}</span>
                          {ratingObj.key && ratingObj.key !== 'neutral' && ratingObj.key !== 'normal' && (
                            <span className={`broadcast-rating-badge ${ratingObj.key}`} style={{ width: 'fit-content' }}>
                              {ratingObj.label.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* KDA block */}
                      <div className="broadcast-match-kda">
                        <div className="broadcast-kda-nums mono">
                          <span>{kills}</span>
                          <span className="slash">/</span>
                          <span className="deaths">{deaths}</span>
                          <span className="slash">/</span>
                          <span>{assists}</span>
                        </div>
                        <span className="broadcast-kda-ratio mono">
                          {kda === 'Perfect' ? '∞ KDA' : `${kda} KDA`}
                        </span>
                      </div>

                      {/* Stats */}
                      <div className="broadcast-match-stats mono">
                        <div className="stat-row">
                          <span className="stat-val">{cs} CS</span>
                          <span className="stat-label">({csMin}/m)</span>
                        </div>
                        <div className="stat-row text-secondary">
                          <span className="stat-val">{kp}% KP</span>
                        </div>
                      </div>

                      {/* Spacer element replacing old badge block to preserve grid structure */}
                      <div className="broadcast-match-badge"></div>

                      {/* Expand Chevron */}
                      <div className="broadcast-match-chevron">
                        <span className={`chevron-icon ${isExpanded ? 'rotated' : ''}`}>▼</span>
                      </div>
                    </div>

                    {/* Detailed expanded team tables */}
                    {isExpanded && (
                      <div className="broadcast-match-details" onClick={(e) => e.stopPropagation()}>
                        <div className="broadcast-expanded-container">
                          {renderTeamTable(match, 100, Math.max(...(match.participants?.map(p => p.damageDealt || 0) || [1])))}
                          {renderTeamTable(match, 200, Math.max(...(match.participants?.map(p => p.damageDealt || 0) || [1])))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }))}
            </div>
          </main>
          </div>
        </div>
      )}

      {activeTab === 'champions' && (
        <div className="broadcast-classic-inject-wrapper">
          {renderChampionsTab()}
        </div>
      )}

      {activeTab === 'aram' && (
        <div className="broadcast-classic-inject-wrapper">
          {renderAramTab()}
        </div>
      )}

      {activeTab === 'live' && (
        <div className="broadcast-classic-inject-wrapper">
          {renderLiveTab()}
        </div>
      )}
    </div>
  );
}
