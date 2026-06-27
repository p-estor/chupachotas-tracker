import React from 'react';

export default function TrackerProfilePro({
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

  const renderProOverview = () => (
    <div className="pro-terminal-grid">
      {/* SIDEBAR */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* RANKED STATS */}
        {summoner.ranks?.solo && (
          <div className="pro-terminal-panel">
            <div className="pro-terminal-panel-title">RANKED_SOLO</div>
            <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>TIER</span>
                <span className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                  {summoner.ranks.solo.tier} {summoner.ranks.solo.rank}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>LP</span>
                <span className="mono">{summoner.ranks.solo.leaguePoints}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>W/L</span>
                <span className="mono">
                  <span style={{ color: 'var(--win-color)' }}>{summoner.ranks.solo.wins}W</span>
                  {' '}-{' '}
                  <span style={{ color: 'var(--loss-color)' }}>{summoner.ranks.solo.losses}L</span>
                  {' '}({summoner.ranks.solo.winRate}%)
                </span>
              </div>
            </div>
          </div>
        )}

        {summoner.ranks?.flex && (
          <div className="pro-terminal-panel">
            <div className="pro-terminal-panel-title">RANKED_FLEX</div>
            <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>TIER</span>
                <span className="mono" style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>
                  {summoner.ranks.flex.tier} {summoner.ranks.flex.rank}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>W/L</span>
                <span className="mono">
                  <span style={{ color: 'var(--win-color)' }}>{summoner.ranks.flex.wins}W</span>
                  {' '}-{' '}
                  <span style={{ color: 'var(--loss-color)' }}>{summoner.ranks.flex.losses}L</span>
                  {' '}({summoner.ranks.flex.winRate}%)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* QUEUE FILTERS */}
        <div className="pro-terminal-panel">
          <div className="pro-terminal-panel-title">QUEUE_FILTER</div>
          <div style={{ padding: '0.75rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {[
              { id: 'all', label: 'ALL' },
              { id: 'ranked_solo', label: 'SOLO' },
              { id: 'ranked_flex', label: 'FLEX' },
              { id: 'aram', label: 'ARAM' },
              { id: 'normal', label: 'NORM' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setQueueFilter(f.id)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  background: queueFilter === f.id ? 'var(--accent-cyan)' : 'transparent',
                  color: queueFilter === f.id ? '#000' : 'var(--text-muted)',
                  border: '1px solid var(--border-normal)',
                  padding: '0.2rem 0.5rem',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* CHAMPION PERFORMANCE */}
        <div className="pro-terminal-panel">
          <div className="pro-terminal-panel-title">CHAMP_PERFORMANCE</div>
          {loadingStatsMatches ? (
            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              FETCHING_DATA_STREAM...
            </div>
          ) : (
            <table className="pro-data-table pro-champ-perf-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>CHAMP</th>
                  <th>KDA</th>
                  <th>CS/m</th>
                  <th>WR%</th>
                </tr>
              </thead>
              <tbody>
                {getSidebarChampionStats().slice(0, 7).map(c => (
                  <tr key={c.name}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <img src={getChampIcon(c.name)} alt="" style={{ width: '16px', height: '16px' }} />
                        <span style={{ fontSize: '0.75rem' }}>{c.name}</span>
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: '0.75rem' }}>{c.kdaRatio}</td>
                    <td className="mono" style={{ fontSize: '0.75rem' }}>{c.csMin}</td>
                    <td className={c.wr >= 55 ? 'pro-data-val-win' : c.wr >= 48 ? 'mono' : 'pro-data-val-loss'}
                      style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      {c.wr}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </aside>

      {/* MAIN: MATCH LOG */}
      <main>
        {renderHistorySummary && renderHistorySummary(matches)}

        <div className="pro-terminal-panel" style={{ marginTop: '1rem' }}>
          <div className="pro-terminal-panel-title">MATCH_LOG</div>
          <table className="pro-data-table">
            <thead>
              <tr>
                <th style={{ width: '8px', padding: '0.5rem 0' }}></th>
                <th>CAMPEÓN</th>
                <th>KDA</th>
                <th>CS / KP</th>
                <th>RATING</th>
                <th style={{ width: '24px' }}></th>
              </tr>
            </thead>
            <tbody>
              {matches?.map((match) => {
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

                return (
                  <React.Fragment key={match.matchId}>
                    <tr
                      className={isWin ? 'pro-row-win' : 'pro-row-loss'}
                      onClick={() => setExpandedMatchId(isExpanded ? null : match.matchId)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Celda de color — el box-shadow inset actúa de borde */}
                      <td style={{ padding: '0', width: '8px' }}></td>

                      {/* Campeón + resultado */}
                      <td>
                        <div className="pro-match-champ-block">
                          <img
                            src={getChampIcon(champName)}
                            alt={champName}
                            className="pro-match-champ-img"
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span className="pro-match-champ-name">{champName}</span>
                            <span className={`pro-match-result ${isWin ? 'pro-data-val-win' : 'pro-data-val-loss'}`}>
                              {isWin ? 'VICTORY' : 'DEFEAT'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* KDA */}
                      <td>
                        <div className="pro-match-kda-block">
                          <span className="pro-match-kda-main">
                            <span style={{ color: 'var(--text-primary)' }}>{kills}</span>
                            {' / '}
                            <span style={{ color: 'var(--loss-color)' }}>{deaths}</span>
                            {' / '}
                            <span style={{ color: 'var(--text-primary)' }}>{assists}</span>
                          </span>
                          <span className="pro-match-kda-ratio">
                            {kda === 'Perfect' ? '∞ KDA' : `${kda} KDA`}
                          </span>
                        </div>
                      </td>

                      {/* CS y KP */}
                      <td>
                        <div className="pro-match-stat-block">
                          <span className="pro-match-stat-main">{cs} CS <span className="pro-match-stat-sub">({csMin}/m)</span></span>
                          <span className="pro-match-stat-sub">{kp}% KP</span>
                        </div>
                      </td>

                      {/* Rating */}
                      <td>
                        {ratingObj.key && ratingObj.key !== 'neutral' && ratingObj.key !== 'normal' && (
                          <span className={`pro-rating-badge ${ratingObj.key}`}>
                            {ratingObj.label.toUpperCase()}
                          </span>
                        )}
                      </td>

                      {/* Expand chevron */}
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textAlign: 'center' }}>
                        {isExpanded ? '▲' : '▼'}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-normal)' }}>
                            {renderTeamTable(match, 100, Math.max(...(match.participants?.map(p => p.damageDealt || 0) || [1])))}
                            {renderTeamTable(match, 200, Math.max(...(match.participants?.map(p => p.damageDealt || 0) || [1])))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );

  return (
    <div className="pro-terminal-container">

      {/* HEADER */}
      <div className="pro-terminal-header">
        <div>
          <div className="pro-terminal-title">
            {summoner.gameName} <span style={{ color: 'var(--text-muted)' }}>#{summoner.tagLine}</span>
          </div>
          <div className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', letterSpacing: '1px' }}>
            NIVEL {summoner.summonerLevel}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SESSION WR</div>
          <div className={`pro-data-val-${winRate >= 50 ? 'win' : 'loss'}`} style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {winRate}% ({wins}W {losses}L)
          </div>
        </div>
      </div>

      {/* TERMINAL NAV */}
      <div className="pro-terminal-nav">
        {[
          { id: 'overview', label: 'OVERVIEW' },
          { id: 'champions', label: 'CHAMPIONS' },
          { id: 'aram', label: 'ARAM' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`pro-terminal-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENIDO */}
      {activeTab === 'overview' && renderProOverview()}
      {activeTab === 'champions' && <div className="pro-tab-classic-inject">{renderChampionsTab()}</div>}
      {activeTab === 'aram' && <div className="pro-tab-classic-inject">{renderAramTab()}</div>}

    </div>
  );
}
