import React from 'react';

export default function TrackerProfilePro({ 
  summoner, 
  matches, 
  statsMatches, 
  championMap, 
  runeMap,
  getChampIcon,
  getProfileIcon,
  getSpellIcon,
  getPerformanceLabel,
  getMatchPerformanceData
}) {
  if (!summoner) return null;

  // Calculamos el winrate global de las partidas cargadas
  const totalMatches = matches?.length || 0;
  const wins = matches?.filter(m => {
    const p = m.participants.find(part => part.puuid === summoner.puuid);
    return p?.win;
  }).length || 0;
  const losses = totalMatches - wins;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  return (
    <div className="pro-terminal-container">
      
      {/* CABECERA */}
      <div className="pro-terminal-header">
        <div>
          <div className="pro-terminal-title">
            {summoner.gameName} <span style={{color: 'var(--text-muted)'}}>#{summoner.tagLine}</span>
          </div>
          <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem'}}>
            LVL {summoner.summonerLevel} | REGION: DATA_STREAM_ACTIVE
          </div>
        </div>
        <div style={{textAlign: 'right'}}>
          <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>SESSION WR</div>
          <div className={`pro-data-val-${winRate >= 50 ? 'win' : 'loss'}`} style={{fontSize: '1.5rem', fontWeight: 600}}>
            {winRate}% ({wins}W {losses}L)
          </div>
        </div>
      </div>

      {/* GRID PRINCIPAL */}
      <div className="pro-terminal-grid">
        
        {/* COLUMNA IZQUIERDA: PARTIDAS */}
        <div className="pro-terminal-panel">
          <div className="pro-terminal-panel-title">MATCH_LOG (RECENT_{totalMatches})</div>
          <table className="pro-data-table">
            <thead>
              <tr>
                <th>RESULT</th>
                <th>CHAMPION</th>
                <th>KDA</th>
                <th>CS</th>
                <th>RATING</th>
              </tr>
            </thead>
            <tbody>
              {matches?.map((match, idx) => {
                const participant = match.participants.find(p => p.puuid === summoner.puuid);
                if (!participant) return null;
                
                const isWin = participant.win;
                const kda = participant.deaths > 0 
                  ? ((participant.kills + participant.assists) / participant.deaths).toFixed(2) 
                  : 'Perfect';
                
                const ratings = getMatchPerformanceData 
                  ? getMatchPerformanceData(match)
                  : match.participants.reduce((acc, p) => {
                      acc[p.puuid] = { score: p.performanceScore || 60, badge: p.win ? 'MVP' : 'ACE' };
                      return acc;
                    }, {});
                const rating = getPerformanceLabel(match, summoner.puuid, ratings);

                return (
                  <tr key={match.matchId || idx}>
                    <td className={isWin ? 'pro-data-val-win' : 'pro-data-val-loss'} style={{fontWeight: 600}}>
                      {isWin ? 'VICTORY' : 'DEFEAT'}
                    </td>
                    <td>
                      <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                        <img src={getChampIcon(participant.championName)} alt="" style={{width: '20px', height: '20px', borderRadius: '2px'}} />
                        {participant.championName}
                      </div>
                    </td>
                    <td className="mono">
                      {participant.kills}/{participant.deaths}/{participant.assists} <span style={{color: 'var(--text-muted)', fontSize: '0.7rem'}}>({kda})</span>
                    </td>
                    <td className="mono">{participant.cs || (participant.totalMinionsKilled + participant.neutralMinionsKilled || 0)}</td>
                    <td>
                      {rating && rating.key !== 'neutral' && (
                        <span style={{
                          background: rating.key === 'mvp' ? 'var(--accent-gold)' : (rating.key === 'ace' ? 'var(--loss-color)' : 'var(--border-normal)'),
                          color: '#000',
                          padding: '0.1rem 0.3rem',
                          borderRadius: '2px',
                          fontSize: '0.65rem',
                          fontWeight: 600
                        }}>
                          {rating.label.toUpperCase()}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* COLUMNA DERECHA: STATS (Placeholder dinámico) */}
        <div className="pro-terminal-panel" style={{height: 'max-content'}}>
          <div className="pro-terminal-panel-title">AGGREGATE_STATS (RECENT_150)</div>
          <div style={{padding: '1rem', color: 'var(--text-muted)'}}>
            {statsMatches ? (
              <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <span>GAMES_ANALYZED:</span>
                  <span className="mono pro-data-val-accent">{statsMatches.length}</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <span>DATA_INTEGRITY:</span>
                  <span className="mono" style={{color: 'var(--win-color)'}}>100%</span>
                </div>
              </div>
            ) : (
              <span className="animate-pulse">FETCHING_DATA_STREAM...</span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
