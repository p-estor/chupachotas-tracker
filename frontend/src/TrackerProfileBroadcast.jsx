import React from 'react';
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
  formatDuration,
  getQueueDisplayName,
  getItemIcon,
  getRuneIcon,
  getSpellIcon,
  loadingStatsMatches,
}) {
  if (!summoner) return null;

  const totalMatches = matches?.length || 0;
  const wins = matches?.filter(m => {
    const p = m.participants?.find(part => part.puuid === summoner.puuid);
    return p?.win;
  }).length || 0;
  const losses = totalMatches - wins;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  // ponytail: no metrics complex filters, simplified overview panel logic
  return (
    <div className="broadcast-container">
      {/* HEADER: Cinematic Broadcast HUD */}
      <header className="broadcast-header">
        <div className="broadcast-header-profile">
          <div className="broadcast-avatar-glow-wrapper">
            <img 
              src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${summoner.profileIconId}.png`} 
              alt="Profile Icon" 
              className="broadcast-avatar-img"
            />
          </div>
          <div className="broadcast-profile-details">
            <h1 className="broadcast-summoner-name">
              {summoner.gameName}<span className="broadcast-tag">#{summoner.tagLine}</span>
            </h1>
            <div className="broadcast-level-pill">
              NIVEL {summoner.summonerLevel}
            </div>
          </div>
        </div>

        <div className="broadcast-header-summary">
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
        <div className="broadcast-grid">
          {/* SIDEBAR */}
          <aside className="broadcast-sidebar">
            {/* SOLOQ CARD */}
            {summoner.ranks?.solo && (
              <div className="broadcast-card broadcast-rank-card" style={{ '--rank-glow-color': getRankBadgeColor(summoner.ranks.solo.tier) }}>
                <div className="broadcast-rank-header">Ranked Solo</div>
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
            )}

            {/* FLEXQ CARD */}
            {summoner.ranks?.flex && (
              <div className="broadcast-card broadcast-rank-card" style={{ '--rank-glow-color': getRankBadgeColor(summoner.ranks.flex.tier) }}>
                <div className="broadcast-rank-header">Ranked Flex</div>
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
              {matches?.map(match => {
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

                // DDragon Splash Art URL for background mask
                const champSplashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champName}_0.jpg`;

                return (
                  <div 
                    key={match.matchId}
                    className={`broadcast-match-card ${isWin ? 'win' : 'loss'} ${isExpanded ? 'expanded' : ''} ${isMvp ? 'mvp-glow' : ''} ${isAce ? 'ace-glow' : ''}`}
                    onClick={() => setExpandedMatchId(isExpanded ? null : match.matchId)}
                  >
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
                      <div className="broadcast-match-champ">
                        <img src={getChampIcon(champName)} alt={champName} className="broadcast-match-avatar" />
                        <span className="broadcast-match-champ-name">{champName}</span>
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

                      {/* Badge / Rating */}
                      <div className="broadcast-match-badge">
                        {ratingObj.key && ratingObj.key !== 'neutral' && ratingObj.key !== 'normal' && (
                          <span className={`broadcast-rating-badge ${ratingObj.key}`}>
                            {ratingObj.label.toUpperCase()}
                          </span>
                        )}
                      </div>

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
              })}
            </div>
          </main>
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
    </div>
  );
}
