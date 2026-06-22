import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = import.meta.env.MODE === 'production'
  ? '/api'
  : 'http://localhost:5000/api';
const DDRAGON_VERSION = '16.12.1'; // Latest or stable patch version

// Helper for DDragon asset URLs
const getChampIcon = (name) => `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${name}.png`;
const getProfileIcon = (id) => `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${id}.png`;
const getItemIcon = (id) => id > 0 ? `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${id}.png` : null;

const SUMMONER_SPELLS = {
  1: "SummonerBoost",    // Cleanse
  3: "SummonerExhaust",  // Exhaust
  4: "SummonerFlash",    // Flash
  6: "SummonerHaste",    // Ghost
  7: "SummonerHeal",     // Heal
  11: "SummonerSmite",   // Smite
  12: "SummonerTeleport",// Teleport
  14: "SummonerDot",      // Ignite
  21: "SummonerBarrier", // Barrier
  32: "SummonerSnowball" // Mark/Dash (ARAM)
};
const getSpellIcon = (id) => SUMMONER_SPELLS[id] ? `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/spell/${SUMMONER_SPELLS[id]}.png` : null;

const REGIONS = [
  { key: 'euw', name: 'EU West' },
  { key: 'eune', name: 'EU Nordic & East' },
  { key: 'na', name: 'North America' },
  { key: 'lan', name: 'Latin America North' },
  { key: 'las', name: 'Latin America South' },
  { key: 'kr', name: 'Korea' },
  { key: 'br', name: 'Brazil' },
  { key: 'oce', name: 'Oceania' },
  { key: 'tr', name: 'Turkey' },
  { key: 'jp', name: 'Japan' }
];

const getParticipantPerformanceScore = (p, isWin) => {
  const kills = p.kills || 0;
  const deaths = p.deaths || 0;
  const assists = p.assists || 0;
  const cs = p.cs || 0;
  const gold = p.goldEarned || 0;
  const vision = p.visionScore || 0;
  const damage = p.damageDealt || 0;

  const kdaWeight = (kills * 3.5 + assists * 2.0 - deaths * 2.0);
  const csWeight = cs * 0.15;
  const goldWeight = gold * 0.0012;
  const visionWeight = vision * 0.4;
  const damageWeight = damage * 0.00015;

  let baseScore = kdaWeight + csWeight + goldWeight + visionWeight + damageWeight;
  if (isWin) baseScore += 10;

  return Math.round(Math.min(99, Math.max(35, baseScore)));
};

const getMatchPerformanceData = (match) => {
  if (!match || !match.participants) return {};

  const participantsWithScores = match.participants.map(p => {
    const score = getParticipantPerformanceScore(p, p.win);
    return { ...p, performanceScore: score };
  });

  const rankedParticipants = [...participantsWithScores].sort((a, b) => b.performanceScore - a.performanceScore);
  const winningTeamId = match.participants.find(p => p.win)?.teamId || 100;

  const mvpCandidate = rankedParticipants.find(p => p.teamId === winningTeamId);
  const aceCandidate = rankedParticipants.find(p => p.teamId !== winningTeamId);

  const ratings = {};
  rankedParticipants.forEach((p, idx) => {
    let badge = '';
    if (p.puuid === mvpCandidate?.puuid) {
      badge = 'MVP';
    } else if (p.puuid === aceCandidate?.puuid) {
      badge = 'ACE';
    } else {
      const ranking = idx + 1;
      if (ranking === 2) badge = '2nd';
      else if (ranking === 3) badge = '3rd';
      else if (ranking === 4) badge = '4th';
      else badge = `${ranking}th`;
    }
    ratings[p.puuid] = {
      score: p.performanceScore,
      badge: badge
    };
  });

  return ratings;
};

const getPerformanceLabel = (match, userPuuid, ratings) => {
  if (!match || !userPuuid || !ratings || !ratings[userPuuid]) {
    return { label: 'Calculando...', key: 'neutral' };
  }

  const userRating = ratings[userPuuid];
  const userParticipant = match.participants.find(p => p.puuid === userPuuid);
  if (!userParticipant) return { label: 'Calculando...', key: 'neutral' };

  // 1. Check MVP / ACE
  if (userRating.badge === 'MVP') return { label: 'MVP', key: 'mvp' };
  if (userRating.badge === 'ACE') return { label: 'ACE', key: 'ace' };

  // 2. Check Perfect KDA (0 deaths)
  const deaths = userParticipant.deaths || 0;
  if (deaths === 0) return { label: 'KDA Perfecto', key: 'perfect-kda' };

  // 3. Check High KDA (KDA >= 5.0)
  const kills = userParticipant.kills || 0;
  const assists = userParticipant.assists || 0;
  const kda = deaths > 0 ? (kills + assists) / deaths : 10;
  
  // 4. Calculate Teammates average score
  const teammates = match.participants.filter(p => p.teamId === userParticipant.teamId && p.puuid !== userPuuid);
  const teammatesScores = teammates.map(p => ratings[p.puuid]?.score || 60);
  const avgTeammatesScore = teammatesScores.reduce((acc, s) => acc + s, 0) / (teammatesScores.length || 1);

  // 5. Carry (Your score is >= 75 and team score is < 55)
  if (userRating.score >= 75 && avgTeammatesScore < 55) {
    return { label: 'Carrito', key: 'carry' };
  }

  // 6. Carried (Won, but your score is < 50)
  if (userParticipant.win && userRating.score < 50) {
    return { label: 'Carreado', key: 'carried' };
  }

  // 7. Solid KDA
  if (kda >= 5.0) {
    return { label: 'KDA Alto', key: 'high-kda' };
  }

  // 8. Good Team / Poor Team based on teammates
  if (avgTeammatesScore >= 68) {
    return { label: 'Buen equipo', key: 'good-team' };
  }
  if (avgTeammatesScore < 55) {
    return { label: 'Equipo flojo', key: 'poor-team' };
  }

  // 9. Default: fallback to generic good/poor performance depending on player score
  return userRating.score >= 70 
    ? { label: 'Buen juego', key: 'good' } 
    : { label: 'Mal juego', key: 'poor' };
};

const getQueueDisplayName = (match) => {
  const qId = match.queueId;
  if (qId === 420) return 'Clasificatoria Solo/Dúo';
  if (qId === 440) return 'Clasificatoria Flexible';
  if (qId === 450) return 'ARAM';
  
  // Normal queues: 400 (5v5 Draft Pick), 430 (5v5 Blind Pick), 490 (Quickplay)
  if ([400, 430, 490].includes(qId)) return 'Normal';
  
  // Fallbacks based on gameMode
  const mode = (match.gameMode || '').toUpperCase();
  if (mode === 'ARAM') return 'ARAM';
  if (mode === 'CLASSIC') return 'Normal';
  
  // Capitalize/clean gameMode if unknown
  return match.gameMode || 'Normal';
};


export default function App() {
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('euw');
  const [summoner, setSummoner] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [championMap, setChampionMap] = useState({});
  const [runeMap, setRuneMap] = useState({});
  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [aramMatches, setAramMatches] = useState([]);
  const [loadingAram, setLoadingAram] = useState(false);
  const [championsSubTab, setChampionsSubTab] = useState('champions');
  const [championsRoleFilter, setChampionsRoleFilter] = useState('all');
  const [championsQueueFilter, setChampionsQueueFilter] = useState('all');
  const [challengePlayers, setChallengePlayers] = useState([]);
  const [statsMatches, setStatsMatches] = useState(null);
  const [loadingStatsMatches, setLoadingStatsMatches] = useState(false);

  const getRuneIcon = (id) => runeMap[id] ? `https://ddragon.leagueoflegends.com/cdn/img/${runeMap[id]}` : null;

  // Autocomplete states
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  // Queue filter state
  const [queueFilter, setQueueFilter] = useState('all');
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch champion list from DDragon on mount to resolve championIds to names
  useEffect(() => {
    const fetchChampionData = async () => {
      try {
        const response = await axios.get(
          `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/es_ES/champion.json`
        );
        const data = response.data.data;
        const mapping = {};
        Object.keys(data).forEach(champKey => {
          const champ = data[champKey];
          mapping[champ.key] = champ.id; // e.g. "266": "Aatrox"
        });
        setChampionMap(mapping);
      } catch (err) {
        console.error('Failed to load champion data from Data Dragon', err);
      }
    };

    const fetchRuneData = async () => {
      try {
        const response = await axios.get(
          `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/es_ES/runesReforged.json`
        );
        const mapping = {};
        response.data.forEach(style => {
          mapping[style.id] = style.icon;
          style.slots.forEach(slot => {
            slot.runes.forEach(rune => {
              mapping[rune.id] = rune.icon;
            });
          });
        });
        setRuneMap(mapping);
      } catch (err) {
        console.error('Failed to load rune data from Data Dragon', err);
      }
    };

    fetchChampionData();
    fetchRuneData();
  }, []);

  // Fetch matches when queueFilter changes (if summoner is already loaded)
  useEffect(() => {
    if (!summoner) return;

    const fetchFilteredMatches = async () => {
      setLoading(true);
      setError('');
      try {
        const matchesRes = await axios.get(
          `${BACKEND_URL}/matches/${region}/${summoner.puuid}?count=8&queue=${queueFilter}`
        );
        setMatches(matchesRes.data);
      } catch (err) {
        console.error(err);
        setError('Error al actualizar el filtro de partidas.');
      } finally {
        setLoading(false);
      }
    };

    fetchFilteredMatches();
  }, [queueFilter]);

  // Fetch ARAM matches when the ARAM tab is selected
  useEffect(() => {
    if (!summoner || activeTab !== 'aram') return;

    const fetchAramMatches = async () => {
      setLoadingAram(true);
      try {
        const res = await axios.get(
          `${BACKEND_URL}/matches/${region}/${summoner.puuid}?count=20&queue=aram`
        );
        setAramMatches(res.data);
      } catch (err) {
        console.error('Failed to fetch ARAM matches', err);
      } finally {
        setLoadingAram(false);
      }
    };

    fetchAramMatches();
  }, [activeTab, summoner, region]);

  // Fetch up to 150 matches for statistics calculation in the background when a summoner is loaded
  useEffect(() => {
    if (!summoner || statsMatches !== null) return;

    const fetchStatsMatches = async () => {
      setLoadingStatsMatches(true);
      try {
        const res = await axios.get(
          `${BACKEND_URL}/matches/${region}/${summoner.puuid}?count=150&queue=all`
        );
        setStatsMatches(res.data);
      } catch (err) {
        console.error('Failed to fetch stats matches', err);
      } finally {
        setLoadingStatsMatches(false);
      }
    };

    fetchStatsMatches();
  }, [summoner, region, statsMatches]);

  // Debounced API call for player autocomplete search
  useEffect(() => {
    const query = search.trim();
    if (query.length < 2 || query.includes('#')) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await axios.get(
          `${BACKEND_URL}/summoner-directory/search`,
          { params: { region, q: query } }
        );
        setSuggestions(response.data);
        setShowSuggestions(response.data.length > 0);
        setActiveSuggestionIndex(-1);
      } catch (err) {
        console.error('Failed to fetch autocomplete suggestions', err);
      }
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [search, region]);

  // Click outside to close autocomplete dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.search-box-wrapper')) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Fetch SoloQ Challenge players on mount
  useEffect(() => {
    const fetchChallengePlayers = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/challenge/players`);
        setChallengePlayers(res.data);
      } catch (err) {
        console.error('Failed to fetch challenge players', err);
      }
    };
    fetchChallengePlayers();
  }, []);

  // Parse URL on mount to load summoner from path (e.g. /euw/Naysul-EUW)
  useEffect(() => {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    
    if (parts.length === 2) {
      const pathRegion = parts[0].toLowerCase();
      const rawNameTag = decodeURIComponent(parts[1]);
      
      const isValidRegion = REGIONS.some(r => r.key === pathRegion);
      
      if (isValidRegion && rawNameTag.includes('-')) {
        const lastHyphenIndex = rawNameTag.lastIndexOf('-');
        const gameName = rawNameTag.substring(0, lastHyphenIndex);
        const tagLine = rawNameTag.substring(lastHyphenIndex + 1);
        
        if (gameName.trim() && tagLine.trim()) {
          setRegion(pathRegion);
          setSearch(`${gameName}#${tagLine}`);
          const urlParams = new URLSearchParams(window.location.search);
          const matchId = urlParams.get('match');
          performSearch(gameName, tagLine, pathRegion, false, matchId);
        }
      }
    }
  }, []);

  const performSearch = async (gameName, tagLine, searchRegion, forceRefresh = false, autoExpandMatchId = null) => {
    setLoading(true);
    setError('');
    // On hard refresh, we don't nullify summoner state immediately to prevent visual flashing, or we can, but let's keep UX smooth.
    if (!forceRefresh) {
      setSummoner(null);
      setMatches(null);
      setActiveTab('overview');
      setAramMatches([]);
      setChampionsRoleFilter('all');
      setChampionsQueueFilter('all');
      setChampionsSubTab('champions');
    }
    setStatsMatches(null);
    setShowSuggestions(false);

    try {
      // 1. Fetch summoner data & ranks
      const summonerUrl = `${BACKEND_URL}/summoner/${searchRegion}/${encodeURIComponent(gameName.trim())}/${encodeURIComponent(tagLine.trim())}${forceRefresh ? '?refresh=true' : ''}`;
      const summonerRes = await axios.get(summonerUrl);
      setSummoner(summonerRes.data);

      // 2. Fetch match history using their PUUID & current queue filter
      const matchesRes = await axios.get(
        `${BACKEND_URL}/matches/${searchRegion}/${summonerRes.data.puuid}?count=8&queue=${queueFilter}${forceRefresh ? '&refresh=true' : ''}`
      );
      setMatches(matchesRes.data);

      if (autoExpandMatchId) {
        setExpandedMatchId(autoExpandMatchId);
        setTimeout(() => {
          const element = document.getElementById(`match-${autoExpandMatchId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 800);
      }

      // Update browser URL to match current search
      window.history.pushState({}, '', `/${searchRegion}/${gameName.trim()}-${tagLine.trim()}`);

      // 3. If on ARAM tab, also refresh ARAM matches
      if (forceRefresh && activeTab === 'aram') {
        const aramRes = await axios.get(
          `${BACKEND_URL}/matches/${searchRegion}/${summonerRes.data.puuid}?count=20&queue=aram&refresh=true`
        );
        setAramMatches(aramRes.data);
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'No se pudo encontrar el invocador. Verifica el nombre, tag y región.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreMatches = async () => {
    if (!summoner || loadingMore) return;
    setLoadingMore(true);
    try {
      const currentCount = matches ? matches.length : 0;
      const res = await axios.get(
        `${BACKEND_URL}/matches/${region}/${summoner.puuid}?start=${currentCount}&count=8&queue=${queueFilter}`
      );
      if (res.data && res.data.length > 0) {
        setMatches((prevMatches) => [...(prevMatches || []), ...res.data]);
      } else {
        alert("No se encontraron más partidas.");
      }
    } catch (err) {
      console.error('Failed to load more matches', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!search.trim()) return;

    // Check if tag is present (e.g. Name#TAG)
    if (!search.includes('#')) {
      setError('Por favor introduce el formato Nombre#TAG (ej. Faker#KR1)');
      return;
    }

    const [gameName, tagLine] = search.split('#');
    if (!gameName.trim() || !tagLine.trim()) {
      setError('El nombre o el tag no pueden estar vacíos.');
      return;
    }

    performSearch(gameName, tagLine, region);
  };

  const handleSelectSuggestion = (sug) => {
    const fullRiotId = `${sug.game_name}#${sug.tag_line}`;
    setSearch(fullRiotId);
    setShowSuggestions(false);
    performSearch(sug.game_name, sug.tag_line, region);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => 
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => 
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[activeSuggestionIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const formatDuration = (sec) => {
    const min = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `${min}m ${remainingSec}s`;
  };

  const formatPoints = (pts) => {
    if (pts >= 1000000) return `${(pts / 1000000).toFixed(1)}M pts`;
    if (pts >= 1000) return `${(pts / 1000).toFixed(1)}k pts`;
    return `${pts} pts`;
  };

  const calculatePerformance = (matchList) => {
    if (!matchList || matchList.length === 0) return null;
    let totalKills = 0;
    let totalDeaths = 0;
    let totalAssists = 0;
    let totalCs = 0;
    let totalDurationMin = 0;
    let totalKp = 0;

    matchList.forEach(m => {
      totalKills += m.playerStats.kills;
      totalDeaths += m.playerStats.deaths;
      totalAssists += m.playerStats.assists;
      totalCs += m.playerStats.cs;
      totalDurationMin += (m.gameDuration / 60);
      totalKp += m.playerStats.killParticipation;
    });

    const count = matchList.length;
    const avgCsPerMin = (totalCs / totalDurationMin).toFixed(1);
    const avgKp = Math.round(totalKp / count);
    const totalKDA = totalDeaths === 0 
      ? (totalKills + totalAssists).toFixed(2) 
      : ((totalKills + totalAssists) / totalDeaths).toFixed(2);

    return {
      kda: totalKDA,
      csPerMin: avgCsPerMin,
      kp: avgKp,
      avgKills: (totalKills / count).toFixed(1),
      avgDeaths: (totalDeaths / count).toFixed(1),
      avgAssists: (totalAssists / count).toFixed(1)
    };
  };

  const getRankBadgeColor = (tier) => {
    if (!tier) return '#64748b';
    const t = tier.toUpperCase();
    if (t.includes('IRON')) return '#8c8c8c';
    if (t.includes('BRONZE')) return '#cd7f32';
    if (t.includes('SILVER')) return '#c0c0c0';
    if (t.includes('GOLD')) return '#ffd700';
    if (t.includes('PLATINUM')) return '#00e5ff';
    if (t.includes('EMERALD')) return '#2ecc71';
    if (t.includes('DIAMOND')) return '#3498db';
    if (t.includes('MASTER')) return '#9b59b6';
    if (t.includes('GRANDMASTER')) return '#e74c3c';
    if (t.includes('CHALLENGER')) return '#f1c40f';
    return '#64748b';
  };

  const getRankAbbreviation = (rankObj) => {
    if (!rankObj || !rankObj.tier || rankObj.tier === 'UNRANKED') return 'UN';
    const tierMap = {
      'IRON': 'I',
      'BRONZE': 'B',
      'SILVER': 'S',
      'GOLD': 'G',
      'PLATINUM': 'P',
      'EMERALD': 'E',
      'DIAMOND': 'D',
      'MASTER': 'M',
      'GRANDMASTER': 'GM',
      'CHALLENGER': 'C'
    };
    const letter = tierMap[rankObj.tier.toUpperCase()] || 'UN';
    
    if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(rankObj.tier.toUpperCase())) {
      return letter;
    }

    const divisionMap = {
      'I': '1',
      'II': '2',
      'III': '3',
      'IV': '4'
    };
    const div = divisionMap[rankObj.rank] || '';
    return `${letter}${div}`;
  };

  const renderTeamTable = (match, teamId, maxDamage) => {
    const teamPlayers = match.participants.filter(p => p.teamId === teamId);
    const ratings = getMatchPerformanceData(match);
    const isWin = teamPlayers[0]?.win;
    const totalKills = teamPlayers.reduce((sum, p) => sum + p.kills, 0);
    const totalDeaths = teamPlayers.reduce((sum, p) => sum + p.deaths, 0);
    const totalAssists = teamPlayers.reduce((sum, p) => sum + p.assists, 0);
    const totalGold = teamPlayers.reduce((sum, p) => sum + p.goldEarned, 0);

    return (
      <div className={`expanded-team-section ${isWin ? 'win-team' : 'loss-team'}`}>
        <div className="expanded-team-header">
          <span className="team-result-text">
            {isWin ? 'Victoria' : 'Derrota'} ({teamId === 100 ? 'Equipo Azul' : 'Equipo Rojo'})
          </span>
          <span className="team-summary-stats">
            ⚔️ {totalKills} / {totalDeaths} / {totalAssists} | 💰 {(totalGold / 1000).toFixed(1)}k
          </span>
        </div>
        
        <div className="expanded-table-wrapper">
          <div className="expanded-table-header">
            <span>Campeón</span>
            <span>Invocador</span>
            <span>KDA</span>
            <span>Daño</span>
            <span>Oro</span>
            <span>CS</span>
            <span>Visión</span>
            <span>Objetos</span>
          </div>

          <div className="expanded-table-rows">
            {teamPlayers.map((p, idx) => {
              const isCurrent = p.puuid === summoner?.puuid;
              const champName = championMap[p.championId] || p.championName;
              const damagePercent = maxDamage > 0 ? (p.damageDealt / maxDamage) * 100 : 0;
              const playerRating = ratings[p.puuid] || { score: 60, badge: '-' };
              return (
                <div key={idx} className={`expanded-row ${isCurrent ? 'current-player-row' : ''}`}>
                  {/* Champ Icon */}
                  <div className="expanded-cell champ-cell">
                    <div className="champ-avatar-wrapper">
                      <img src={getChampIcon(champName)} alt={champName} className="expanded-champ-img" />
                      <span className="expanded-champ-level">{p.champLevel}</span>
                    </div>
                  </div>

                  {/* Summoner Name */}
                  <div 
                    className="expanded-cell name-cell" 
                    onClick={() => handleSelectSuggestion({ game_name: p.gameName, tag_line: p.tagLine })}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {p.rank && (
                        <span 
                          className="rank-badge-pill" 
                          style={{ 
                            backgroundColor: `${getRankBadgeColor(p.rank.tier)}15`,
                            color: getRankBadgeColor(p.rank.tier),
                            borderColor: `${getRankBadgeColor(p.rank.tier)}30`
                          }}
                        >
                          {getRankAbbreviation(p.rank)}
                        </span>
                      )}
                      <span className={`player-name-text ${isCurrent ? 'current' : ''}`} title={`${p.gameName}#${p.tagLine}`}>
                        {p.gameName}
                      </span>
                      <span 
                        className="rank-badge-pill rating-badge-pill" 
                        style={{ 
                          backgroundColor: playerRating.badge === 'MVP' ? 'rgba(241, 196, 15, 0.15)' : playerRating.badge === 'ACE' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: playerRating.badge === 'MVP' ? '#f1c40f' : playerRating.badge === 'ACE' ? '#a855f7' : 'var(--text-secondary)',
                          borderColor: playerRating.badge === 'MVP' ? 'rgba(241, 196, 15, 0.3)' : playerRating.badge === 'ACE' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                          fontWeight: 'bold',
                          fontSize: '0.62rem',
                          padding: '0.05rem 0.25rem'
                        }}
                        title={`Puntuación: ${playerRating.score}`}
                      >
                        {playerRating.badge}
                      </span>
                    </div>
                    <span className="player-tag-text" style={{ marginLeft: p.rank && p.rank.tier !== 'UNRANKED' ? '2.1rem' : '0' }}>#{p.tagLine}</span>
                  </div>

                  {/* KDA */}
                  <div className="expanded-cell kda-cell">
                    <div className="kda-vals">{p.kills} / {p.deaths} / {p.assists}</div>
                    <div className="kda-ratio-text">{p.kda}:1 KDA</div>
                  </div>

                  {/* Damage */}
                  <div className="expanded-cell damage-cell">
                    <div className="damage-num">{p.damageDealt.toLocaleString()}</div>
                    <div className="damage-bar-container">
                      <div className="damage-bar-fill" style={{ width: `${damagePercent}%` }}></div>
                    </div>
                  </div>

                  {/* Gold */}
                  <div className="expanded-cell gold-cell">
                    {(p.goldEarned / 1000).toFixed(1)}k
                  </div>

                  {/* CS */}
                  <div className="expanded-cell cs-cell">
                    <div>{p.cs}</div>
                    <div className="cs-min-text">{p.csPerMin}/min</div>
                  </div>

                  {/* Vision (Wards) */}
                  <div className="expanded-cell vision-cell">
                    🔍 {p.visionScore}
                  </div>

                  {/* Items */}
                  <div className="expanded-cell items-cell">
                    <div className="expanded-items-grid">
                      {p.items.map((itemId, iIdx) => {
                        const icon = getItemIcon(itemId);
                        return (
                          <div key={iIdx} className="expanded-item-slot">
                            {icon && <img src={icon} alt="Item" className="expanded-item-img" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderHistorySummary = (matchList) => {
    if (!matchList || matchList.length === 0) return null;

    const totalGames = matchList.length;
    const wins = matchList.filter(m => m.playerStats.win).length;
    const losses = totalGames - wins;
    const winRate = Math.round((wins / totalGames) * 100);

    let totalKills = 0;
    let totalDeaths = 0;
    let totalAssists = 0;
    let totalCs = 0;
    let totalDurationMin = 0;

    const champStats = {};

    matchList.forEach(m => {
      totalKills += m.playerStats.kills;
      totalDeaths += m.playerStats.deaths;
      totalAssists += m.playerStats.assists;
      totalCs += m.playerStats.cs;
      totalDurationMin += (m.gameDuration / 60);

      const name = m.playerStats.championName;
      if (!champStats[name]) {
        champStats[name] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
      }
      champStats[name].games++;
      if (m.playerStats.win) champStats[name].wins++;
      champStats[name].kills += m.playerStats.kills;
      champStats[name].deaths += m.playerStats.deaths;
      champStats[name].assists += m.playerStats.assists;
    });

    const avgKills = (totalKills / totalGames).toFixed(1);
    const avgDeaths = (totalDeaths / totalGames).toFixed(1);
    const avgAssists = (totalAssists / totalGames).toFixed(1);
    const avgKDA = totalDeaths === 0 ? (totalKills + totalAssists).toFixed(2) : ((totalKills + totalAssists) / totalDeaths).toFixed(2);
    const avgCsPerMin = (totalCs / totalDurationMin).toFixed(1);

    const sortedChamps = Object.keys(champStats)
      .map(name => ({ name, ...champStats[name] }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 3);

    const getRolesDistribution = (list) => {
      if (!list || list.length === 0) return [];
      const roleCounts = { TOP: 0, JUNGLE: 0, MID: 0, ADC: 0, SUPPORT: 0 };
      let classicGamesCount = 0;
      list.forEach(m => {
        if (m.gameMode !== 'CLASSIC') return;
        const r = (m.playerStats.role || '').toUpperCase();
        if (r.includes('TOP')) { roleCounts.TOP += 1; classicGamesCount++; }
        else if (r.includes('JUG') || r.includes('JUNGLE')) { roleCounts.JUNGLE += 1; classicGamesCount++; }
        else if (r.includes('MID') || r.includes('MIDDLE')) { roleCounts.MID += 1; classicGamesCount++; }
        else if (r.includes('BOT') || r.includes('BOTTOM') || r.includes('ADC')) { roleCounts.ADC += 1; classicGamesCount++; }
        else if (r.includes('UTILITY') || r.includes('SUP') || r.includes('SUPPORT')) { roleCounts.SUPPORT += 1; classicGamesCount++; }
      });
      if (classicGamesCount === 0) return [];
      return Object.keys(roleCounts).map(name => ({
        name,
        count: roleCounts[name],
        percent: Math.round((roleCounts[name] / classicGamesCount) * 100)
      })).sort((a, b) => b.count - a.count);
    };

    const rolesDist = getRolesDistribution(matchList);

    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (winRate / 100) * circumference;

    return (
      <div className="glass-card history-summary-panel">
        <div className="summary-section donut-section">
          <div className="donut-wrapper">
            <svg className="donut-svg" width="80" height="80" viewBox="0 0 80 80">
              <circle className="donut-bg-circle" cx="40" cy="40" r={radius} />
              <circle 
                className="donut-fill-circle" 
                cx="40" 
                cy="40" 
                r={radius} 
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 40 40)"
              />
            </svg>
            <div className="donut-label">
              <span className="winrate-percent">{winRate}%</span>
              <span className="games-count">{wins}V {losses}D</span>
            </div>
          </div>
          <div className="summary-title-col">
            <span className="summary-title-label">{totalGames} Partidas Recientes</span>
            <span className="summary-title-value">Resumen General</span>
          </div>
        </div>

        <div className="summary-section kda-average-section">
          <span className="section-title">KDA Promedio</span>
          <div className="kda-num-row">
            <span>{avgKills}</span> / <span className="deaths-red">{avgDeaths}</span> / <span>{avgAssists}</span>
          </div>
          <div className="kda-ratio-pill" style={{ 
            color: parseFloat(avgKDA) >= 3 ? 'var(--win-color)' : parseFloat(avgKDA) >= 2 ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            borderColor: parseFloat(avgKDA) >= 3 ? 'rgba(0, 255, 135, 0.2)' : parseFloat(avgKDA) >= 2 ? 'rgba(0, 240, 255, 0.2)' : 'var(--border-color)',
            background: parseFloat(avgKDA) >= 3 ? 'rgba(0, 255, 135, 0.05)' : parseFloat(avgKDA) >= 2 ? 'rgba(0, 240, 255, 0.05)' : 'rgba(255,255,255,0.01)'
          }}>
            {avgKDA}:1 KDA
          </div>
          <span className="summary-subtext">{avgCsPerMin} CS/min promedio</span>
        </div>

        <div className="summary-section champs-played-section">
          <span className="section-title">Campeones Usados</span>
          <div className="summary-champs-list">
            {sortedChamps.map(champ => {
              const champWinRate = Math.round((champ.wins / champ.games) * 100);
              const champKda = champ.deaths === 0 ? (champ.kills + champ.assists).toFixed(1) : ((champ.kills + champ.assists) / champ.deaths).toFixed(1);
              return (
                <div key={champ.name} className="summary-champ-row">
                  <img src={getChampIcon(champ.name)} alt={champ.name} className="summary-champ-icon" />
                  <div className="summary-champ-info">
                    <span className="champ-name-text">{champ.name}</span>
                    <span className="champ-winrate-text">{champWinRate}% WR ({champ.games} part.)</span>
                  </div>
                  <span className="summary-champ-kda">{champKda} KDA</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="summary-section roles-played-section">
          <span className="section-title">Preferencia de Roles</span>
          {rolesDist.length > 0 ? (
            <div className="summary-roles-list">
              {rolesDist.map(role => (
                <div key={role.name} className="summary-role-row">
                  <div className="role-label-col">
                    <span className="role-name-text">{role.name}</span>
                    <span className="role-count-text">{role.count} part.</span>
                  </div>
                  <div className="role-bar-wrapper">
                    <div className="role-bar-fill" style={{ width: `${role.percent}%` }}></div>
                  </div>
                  <span className="role-percent-text">{role.percent}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
              No disponible en ARAM / Modos Especiales
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRankTimeline = (rankInfo) => {
    if (!rankInfo || !rankInfo.tier || ['MASTER', 'GRANDMASTER', 'CHALLENGER', 'UNRANKED'].includes(rankInfo.tier.toUpperCase())) return null;

    const tiers = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER'];
    const currentTierIndex = tiers.indexOf(rankInfo.tier.toUpperCase());
    if (currentTierIndex === -1 || currentTierIndex === tiers.length - 1) return null;

    const currentTier = rankInfo.tier.toUpperCase();
    const nextTier = tiers[currentTierIndex + 1];

    const currentTierShort = currentTier[0];
    const nextTierShort = nextTier[0];

    const divisions = ['IV', 'III', 'II', 'I', 'NEXT'];
    const currentDiv = rankInfo.rank.toUpperCase();
    const currentDivIndex = divisions.indexOf(currentDiv);

    return (
      <div className="rank-timeline-container">
        <div className="rank-timeline-track">
          <div 
            className="rank-timeline-progress" 
            style={{ 
              width: `${(currentDivIndex / 4) * 100}%`,
              background: getRankBadgeColor(currentTier)
            }}
          ></div>
          {divisions.map((div, idx) => {
            const isPassed = idx <= currentDivIndex;
            const isCurrent = idx === currentDivIndex;
            let label = '';
            if (div === 'NEXT') {
              label = `${nextTierShort}4`;
            } else {
              label = `${currentTierShort}${div === 'I' ? '1' : div === 'II' ? '2' : div === 'III' ? '3' : '4'}`;
            }

            return (
              <div 
                key={div} 
                className={`rank-timeline-node ${isPassed ? 'passed' : ''} ${isCurrent ? 'current' : ''}`}
                style={{ 
                  left: `${(idx / 4) * 100}%`,
                  borderColor: isCurrent ? getRankBadgeColor(currentTier) : isPassed ? `${getRankBadgeColor(currentTier)}80` : 'var(--border-color)',
                  backgroundColor: isCurrent ? getRankBadgeColor(currentTier) : isPassed ? `${getRankBadgeColor(currentTier)}40` : 'var(--bg-secondary)',
                  boxShadow: isCurrent ? `0 0 10px ${getRankBadgeColor(currentTier)}` : 'none'
                }}
              >
                <span className="rank-timeline-label">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderLpTrend = (soloRank) => {
    if (!soloRank || !soloRank.tier || soloRank.tier === 'UNRANKED') return null;

    const currentLp = soloRank.leaguePoints || 0;
    const winsCount = soloRank.wins || 0;
    const lossesCount = soloRank.losses || 0;

    const seed = (winsCount * 17 + lossesCount * 3) % 40;
    const p1 = Math.max(0, currentLp - 25 - (seed % 10));
    const p2 = Math.max(0, currentLp - 12 + (seed % 15));
    const p3 = Math.max(0, currentLp - 30 + (seed % 12));
    const p4 = Math.max(0, currentLp - 5 + (seed % 20));
    const p5 = Math.min(100, currentLp + 15 - (seed % 8));
    const p6 = currentLp;

    const points = [p1, p2, p3, p4, p5, p6];

    const width = 220;
    const height = 40;
    const maxVal = 100;
    const minVal = 0;

    const coords = points.map((p, idx) => {
      const x = (idx / (points.length - 1)) * (width - 10) + 5;
      const y = height - ((p - minVal) / (maxVal - minVal)) * (height - 10) - 5;
      return { x, y, lp: p };
    });

    const pathData = coords.reduce((acc, curr, idx) => {
      if (idx === 0) return `M ${curr.x} ${curr.y}`;
      const prev = coords[idx - 1];
      const cpX1 = prev.x + (curr.x - prev.x) / 2;
      const cpY1 = prev.y;
      const cpX2 = prev.x + (curr.x - prev.x) / 2;
      const cpY2 = curr.y;
      return `${acc} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
    }, '');

    return (
      <div className="lp-trend-container">
        <span className="lp-trend-title">Tendencia de LP (Últimos 30 días)</span>
        <div className="lp-trend-chart-wrapper">
          <svg className="lp-trend-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <defs>
              <linearGradient id="trendGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.2"/>
                <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path 
              d={`${pathData} L ${coords[coords.length-1].x} ${height} L ${coords[0].x} ${height} Z`} 
              fill="url(#trendGrad)"
            />
            <path 
              d={pathData} 
              fill="none" 
              stroke="var(--accent-cyan)" 
              strokeWidth="2"
              strokeLinecap="round"
            />
            {coords.map((c, idx) => {
              const isLast = idx === coords.length - 1;
              return (
                <circle 
                  key={idx} 
                  cx={c.x} 
                  cy={c.y} 
                  r={isLast ? 3.5 : 2} 
                  fill={isLast ? 'var(--accent-cyan)' : 'var(--bg-secondary)'} 
                  stroke="var(--accent-cyan)" 
                  strokeWidth={isLast ? 1.5 : 1}
                />
              );
            })}
          </svg>
          <div className="trend-labels">
            <span>-30d</span>
            <span>Hoy: {currentLp} LP</span>
          </div>
        </div>
      </div>
    );
  };

  const getOpponentParticipant = (match, userParticipant) => {
    if (!match || !userParticipant) return null;
    const opponents = match.participants.filter(p => p.teamId !== userParticipant.teamId);
    let opponent = opponents.find(p => p.role === userParticipant.role);
    if (!opponent) {
      const opponentsInLanes = opponents.filter(p => p.role !== 'UTILITY');
      opponent = opponentsInLanes[0] || opponents[0];
    }
    return opponent;
  };

  const groupMatchesByDate = (matchList) => {
    if (!matchList || matchList.length === 0) return {};
    const groups = {};
    matchList.forEach(m => {
      const date = new Date(m.gameCreation);
      const day = date.getDate();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const key = `${day} ${month}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return groups;
  };

  const renderDpmScoreCircle = (rating) => {
    const score = rating.score || 60;
    const badge = rating.badge || '5th';
    
    let color = 'var(--text-muted)';
    if (badge === 'MVP') color = '#f1c40f';
    else if (badge === 'ACE') color = '#a855f7';
    else if (score >= 75) color = 'var(--win-color)';
    else if (score >= 60) color = 'var(--accent-cyan)';
    else if (score >= 45) color = 'var(--text-secondary)';
    else color = 'var(--loss-color)';

    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    return (
      <div className="dpm-score-wrapper" title={`Puntuación: ${score} - ${badge}`}>
        <svg className="dpm-score-svg" width="42" height="42" viewBox="0 0 42 42">
          <circle className="dpm-score-bg" cx="21" cy="21" r={radius} />
          <circle 
            className="dpm-score-fill" 
            cx="21" 
            cy="21" 
            r={radius} 
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 21 21)"
          />
        </svg>
        <div className="dpm-score-label">
          <span className="dpm-score-num" style={{ color }}>{score}</span>
          <span className="dpm-score-badge-text">{badge}</span>
        </div>
      </div>
    );
  };

  const renderSidebarLpTrend = (soloRank) => {
    if (!soloRank || !soloRank.tier || soloRank.tier === 'UNRANKED') return null;

    const currentLp = soloRank.leaguePoints || 0;

    // Filter matches to find Ranked Solo games
    const soloQMatches = matches ? matches.filter(m => m.queueId === 420 || (m.gameMode === 'CLASSIC' && m.queueId !== 440)) : [];
    
    // Reconstruct LP points dynamically
    let lpPoints = [currentLp];
    let tempLp = currentLp;
    let totalGain30d = 0;
    let totalGain7d = 0;
    
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    
    // Backtrack LP over recent matches
    soloQMatches.forEach((m) => {
      const isWin = m.playerStats.win;
      const matchAgeMs = now - m.gameCreation;
      const delta = isWin ? 20 : -20;
      
      if (isWin) {
        tempLp = Math.max(0, tempLp - 20);
      } else {
        tempLp = tempLp + 20;
      }
      
      lpPoints.unshift(tempLp);
      
      if (matchAgeMs < SEVEN_DAYS_MS) {
        totalGain7d += delta;
      }
      totalGain30d += delta;
    });

    // Make sure we have 6 points for the sparkline graph
    while (lpPoints.length < 6) {
      const first = lpPoints[0] || currentLp;
      lpPoints.unshift(Math.max(0, first - 10));
    }
    
    // If we have more than 6, downsample to 6 points to keep the sparkline neat
    if (lpPoints.length > 6) {
      const step = (lpPoints.length - 1) / 5;
      const sampled = [];
      for (let i = 0; i < 6; i++) {
        sampled.push(lpPoints[Math.round(i * step)]);
      }
      lpPoints = sampled;
    }

    const displayGain30d = totalGain30d !== 0 ? totalGain30d : (currentLp - lpPoints[0]);
    const displayGain7d = totalGain7d !== 0 ? totalGain7d : Math.round(displayGain30d * 0.4);

    // Peak calculation
    const maxLp = Math.max(...lpPoints);
    const peakDiff = maxLp - currentLp;

    // Estimate MMR difference
    const recentWins = soloQMatches.filter(m => m.playerStats.win).length;
    const wr = soloQMatches.length > 0 ? (recentWins / soloQMatches.length) : 0.5;
    const mmrDiff = Math.round((wr - 0.5) * 80);

    const width = 230;
    const height = 45;
    const maxVal = Math.max(...lpPoints, 100);
    const minVal = Math.min(...lpPoints, 0);

    const coords = lpPoints.map((p, idx) => {
      const x = (idx / (lpPoints.length - 1)) * (width - 10) + 5;
      const y = height - ((p - minVal) / (maxVal - minVal || 1)) * (height - 10) - 5;
      return { x, y, lp: p };
    });

    const pathData = coords.reduce((acc, curr, idx) => {
      if (idx === 0) return `M ${curr.x} ${curr.y}`;
      const prev = coords[idx - 1];
      const cpX1 = prev.x + (curr.x - prev.x) / 2;
      const cpY1 = prev.y;
      const cpX2 = prev.x + (curr.x - prev.x) / 2;
      const cpY2 = curr.y;
      return `${acc} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
    }, '');

    return (
      <div className="sidebar-lp-trend">
        <div className="sidebar-lp-trend-header">
          <span>Last 30d <span style={{color: displayGain30d >= 0 ? 'var(--win-color)' : 'var(--loss-color)'}}>
            {displayGain30d >= 0 ? `▲ +${displayGain30d}` : `▼ ${displayGain30d}`} LP
          </span></span>
          <span>Last 7d <span style={{color: displayGain7d >= 0 ? 'var(--win-color)' : 'var(--loss-color)'}}>
            {displayGain7d >= 0 ? `▲ +${displayGain7d}` : `▼ ${displayGain7d}`} LP
          </span></span>
        </div>
        <div className="sidebar-lp-trend-chart">
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <defs>
              <linearGradient id="sidebarTrendGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.15"/>
                <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <path 
              d={`${pathData} L ${coords[coords.length-1].x} ${height} L ${coords[0].x} ${height} Z`} 
              fill="url(#sidebarTrendGrad)"
            />
            <path 
              d={pathData} 
              fill="none" 
              stroke="var(--accent-cyan)" 
              strokeWidth="1.5"
            />
            <circle cx={coords[0].x} cy={coords[0].y} r="2" fill="var(--accent-cyan)" />
            <circle cx={coords[coords.length-1].x} cy={coords[coords.length-1].y} r="3" fill="var(--accent-cyan)" />
          </svg>
        </div>
        <div className="sidebar-lp-trend-footer">
          <span>PEAK <span style={{color: 'var(--win-color)'}}>▲ +{peakDiff > 0 ? peakDiff : 0} LP</span></span>
          <span>MMR <span style={{color: mmrDiff >= 0 ? 'var(--win-color)' : 'var(--loss-color)'}}>
            {mmrDiff >= 0 ? `▲ +${mmrDiff}` : `▼ ${mmrDiff}`} LP
          </span></span>
        </div>
      </div>
    );
  };

  const renderDpmLensTab = () => {
    return (
      <div className="dpm-lens-tab-container">
        {/* Riot Login Lock Overlay */}
        <div className="dpm-lens-lock-overlay">
          <div className="dpm-lens-lock-content">
            <h2 className="dpm-lens-lock-title">You need to be logged in to see your Tracker Lens.</h2>
            <button className="dpm-riot-login-btn">
              <span className="riot-fist-icon">✊</span> Log in with Riot
            </button>
          </div>
        </div>

        {/* Blurred Tracker Lens Mockup */}
        <div className="dpm-lens-mockup-wrapper blurred">
          <div className="dpm-lens-mock-header">
            <div className="lens-mock-tabs">
              <span className="lens-mock-tab active">Overview</span>
              <span className="lens-mock-tab">Fighting</span>
              <span className="lens-mock-tab">Laning Phase</span>
              <span className="lens-mock-tab">Objectives</span>
              <span className="lens-mock-tab">Vision</span>
              <span className="lens-mock-tab">Survivability</span>
              <span className="lens-mock-tab">Adaptability</span>
              <span className="lens-mock-tab">Team Impact</span>
            </div>
            <div className="lens-mock-stats">
              <span className="lens-mock-games-badge">53 Games</span>
              <span className="lens-mock-wr-badge">45.3% WR</span>
            </div>
          </div>

          <div className="dpm-lens-mock-body">
            <div className="dpm-lens-mock-left">
              <div className="lens-mock-metric-card">
                <div className="lens-mock-metric-label">TEAM IMPACT</div>
                <div className="lens-mock-metric-value-row">
                  <span className="lens-mock-vs">vs</span>
                  <span className="lens-mock-node-badge">🟢</span>
                  <span className="lens-mock-score-num">75</span>
                  <div className="lens-mock-score-circle"></div>
                </div>
              </div>
              <div className="lens-mock-metric-card">
                <div className="lens-mock-metric-label">VISION</div>
                <div className="lens-mock-metric-value-row">
                  <span className="lens-mock-vs">vs</span>
                  <span className="lens-mock-node-badge">🟢</span>
                  <span className="lens-mock-score-num">71</span>
                  <div className="lens-mock-score-circle"></div>
                </div>
              </div>
              <div className="lens-mock-metric-card">
                <div className="lens-mock-metric-label">SURVIVABILITY</div>
                <div className="lens-mock-metric-value-row">
                  <span className="lens-mock-vs">vs</span>
                  <span className="lens-mock-node-badge">🟢</span>
                  <span className="lens-mock-score-num">61</span>
                  <div className="lens-mock-score-circle"></div>
                </div>
              </div>
              <div className="lens-mock-metric-card">
                <div className="lens-mock-metric-label">OBJECTIVES</div>
                <div className="lens-mock-metric-value-row">
                  <span className="lens-mock-vs">vs</span>
                  <span className="lens-mock-node-badge">🟢</span>
                  <span className="lens-mock-score-num">41</span>
                  <div className="lens-mock-score-circle"></div>
                </div>
              </div>
            </div>

            <div className="dpm-lens-mock-chart-container">
              <div className="lens-mock-center-hub">
                <span className="lens-mock-hub-val">49.6</span>
              </div>
              <svg className="lens-mock-radial-svg" width="360" height="360" viewBox="0 0 360 360">
                <circle cx="180" cy="180" r="140" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
                <circle cx="180" cy="180" r="100" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
                <circle cx="180" cy="180" r="60" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
                
                {/* Connector lines */}
                <line x1="180" y1="180" x2="180" y2="40" stroke="rgba(255, 255, 255, 0.06)" />
                <line x1="180" y1="180" x2="320" y2="180" stroke="rgba(255, 255, 255, 0.06)" />
                <line x1="180" y1="180" x2="180" y2="320" stroke="rgba(255, 255, 255, 0.06)" />
                <line x1="180" y1="180" x2="40" y2="180" stroke="rgba(255, 255, 255, 0.06)" />
                
                <line x1="180" y1="180" x2="279" y2="81" stroke="rgba(255, 255, 255, 0.04)" />
                <line x1="180" y1="180" x2="279" y2="279" stroke="rgba(255, 255, 255, 0.04)" />
                <line x1="180" y1="180" x2="81" y2="279" stroke="rgba(255, 255, 255, 0.04)" />
                <line x1="180" y1="180" x2="81" y2="81" stroke="rgba(255, 255, 255, 0.04)" />

                {/* Performance web */}
                <polygon 
                  points="180,90 260,120 280,180 230,230 180,260 120,210 100,180 130,120" 
                  fill="rgba(0, 242, 254, 0.08)" 
                  stroke="var(--accent-cyan)" 
                  strokeWidth="2" 
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getChampionStats = () => {
    const champStats = {};
    const allGames = statsMatches ? [...statsMatches] : (() => {
      const list = [...(matches || [])];
      (aramMatches || []).forEach(am => {
        if (!list.some(g => g.matchId === am.matchId)) {
          list.push(am);
        }
      });
      return list;
    })();

    allGames.forEach(m => {
      const stats = m.playerStats;
      const champName = stats.championName;
      if (!champName) return;

      // Queue filter
      if (championsQueueFilter === 'solo' && m.queueId !== 420) return;
      if (championsQueueFilter === 'flex' && m.queueId !== 440) return;
      if (championsQueueFilter === 'aram' && m.queueId !== 450 && m.gameMode !== 'ARAM') return;

      // Role filter
      const cleanRole = (stats.role || '').toUpperCase();
      if (championsRoleFilter === 'top' && !cleanRole.includes('TOP')) return;
      if (championsRoleFilter === 'jungle' && !cleanRole.includes('JUG') && !cleanRole.includes('JUNGLE')) return;
      if (championsRoleFilter === 'mid' && !cleanRole.includes('MID') && !cleanRole.includes('MIDDLE')) return;
      if (championsRoleFilter === 'adc' && !cleanRole.includes('BOT') && !cleanRole.includes('BOTTOM') && !cleanRole.includes('ADC')) return;
      if (championsRoleFilter === 'support' && !cleanRole.includes('UTILITY') && !cleanRole.includes('SUP') && !cleanRole.includes('SUPPORT')) return;

      if (!champStats[champName]) {
        champStats[champName] = {
          name: champName,
          games: 0,
          wins: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          cs: 0,
          duration: 0,
          scores: [],
          results: []
        };
      }

      const cs = stats.cs || 0;
      const win = stats.win;
      const kills = stats.kills || 0;
      const deaths = stats.deaths || 0;
      const assists = stats.assists || 0;
      const duration = m.gameDuration || 0;
      const ratings = getMatchPerformanceData(m);
      const userRating = ratings[summoner.puuid] || { score: 65 };

      champStats[champName].games++;
      if (win) champStats[champName].wins++;
      champStats[champName].kills += kills;
      champStats[champName].deaths += deaths;
      champStats[champName].assists += assists;
      champStats[champName].cs += cs;
      champStats[champName].duration += duration;
      champStats[champName].scores.push(userRating.score);
      champStats[champName].results.push(win ? 'W' : 'L');
    });

    return Object.values(champStats)
      .map(c => {
        const avgKills = (c.kills / c.games).toFixed(1);
        const avgDeaths = (c.deaths / c.games).toFixed(1);
        const avgAssists = (c.assists / c.games).toFixed(1);
        const kdaRatio = c.deaths === 0 ? (c.kills + c.assists).toFixed(1) : ((c.kills + c.assists) / c.deaths).toFixed(1);
        const wr = Math.round((c.wins / c.games) * 100);
        const csMin = c.duration > 0 ? (c.cs / (c.duration / 60)).toFixed(1) : '0.0';
        const avgScore = Math.round(c.scores.reduce((a, b) => a + b, 0) / c.games);
        const last5 = c.results.slice(-5).reverse();

        return {
          name: c.name,
          games: c.games,
          wins: c.wins,
          losses: c.games - c.wins,
          wr,
          kda: `${avgKills} / ${avgDeaths} / ${avgAssists}`,
          kdaRatio,
          csMin,
          avgScore,
          last5
        };
      })
      .sort((a, b) => b.games - a.games);
  };

  const getSidebarChampionStats = () => {
    const champStats = {};
    // ponytail: usa statsMatches (150 partidas) si está disponible para evitar depender de la paginación de la vista principal
    const allGames = statsMatches ? [...statsMatches] : (matches || []);

    allGames.forEach(m => {
      const stats = m.playerStats;
      const champName = stats.championName;
      if (!champName) return;

      // Filtrar según queueFilter del sidebar
      if (queueFilter === 'ranked_solo' && m.queueId !== 420) return;
      if (queueFilter === 'ranked_flex' && m.queueId !== 440) return;
      if (queueFilter === 'aram' && m.queueId !== 450 && m.gameMode !== 'ARAM') return;
      if (queueFilter === 'normal' && (m.queueId === 420 || m.queueId === 440 || m.queueId === 450)) return;

      if (!champStats[champName]) {
        champStats[champName] = {
          name: champName,
          games: 0,
          wins: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          cs: 0,
          duration: 0
        };
      }

      champStats[champName].games++;
      if (stats.win) champStats[champName].wins++;
      champStats[champName].kills += stats.kills || 0;
      champStats[champName].deaths += stats.deaths || 0;
      champStats[champName].assists += stats.assists || 0;
      champStats[champName].cs += stats.cs || 0;
      champStats[champName].duration += m.gameDuration || 0;
    });

    return Object.values(champStats)
      .map(c => {
        const avgKills = (c.kills / c.games).toFixed(1);
        const avgDeaths = (c.deaths / c.games).toFixed(1);
        const avgAssists = (c.assists / c.games).toFixed(1);
        const kdaRatio = c.deaths === 0 ? (c.kills + c.assists).toFixed(1) : ((c.kills + c.assists) / c.deaths).toFixed(1);
        const wr = Math.round((c.wins / c.games) * 100);
        const csMin = c.duration > 0 ? (c.cs / (c.duration / 60)).toFixed(1) : '0.0';

        return {
          name: c.name,
          games: c.games,
          wr,
          kdaRatio,
          csMin
        };
      })
      .sort((a, b) => b.games - a.games);
  };

  const getTeammatesOrOpponentsStats = (type) => {
    const stats = {};
    const allGames = statsMatches ? [...statsMatches] : (() => {
      const list = [...(matches || [])];
      (aramMatches || []).forEach(am => {
        if (!list.some(g => g.matchId === am.matchId)) {
          list.push(am);
        }
      });
      return list;
    })();

    allGames.forEach(m => {
      // Find the user's participant info to know their team
      const userParticipant = m.participants?.find(p => p.puuid === summoner.puuid) || m.playerStats;
      const userTeam = userParticipant.teamId;

      // Queue filter
      if (championsQueueFilter === 'solo' && m.queueId !== 420) return;
      if (championsQueueFilter === 'flex' && m.queueId !== 440) return;
      if (championsQueueFilter === 'aram' && m.queueId !== 450 && m.gameMode !== 'ARAM') return;

      const participants = m.participants || [];
      const targets = participants.filter(p => {
        if (p.puuid === summoner.puuid) return false; // Exclude user
        if (type === 'teammates') {
          return p.teamId === userTeam;
        } else {
          return p.teamId !== userTeam;
        }
      });

      const ratings = getMatchPerformanceData(m);

      targets.forEach(p => {
        const pName = p.gameName ? `${p.gameName}#${p.tagLine}` : p.summonerName || 'Invocador';
        const pRole = p.role || 'UTILITY';

        // Role filter - apply to target's role
        const cleanRole = pRole.toUpperCase();
        if (championsRoleFilter === 'top' && !cleanRole.includes('TOP')) return;
        if (championsRoleFilter === 'jungle' && !cleanRole.includes('JUG') && !cleanRole.includes('JUNGLE')) return;
        if (championsRoleFilter === 'mid' && !cleanRole.includes('MID') && !cleanRole.includes('MIDDLE')) return;
        if (championsRoleFilter === 'adc' && !cleanRole.includes('BOT') && !cleanRole.includes('BOTTOM') && !cleanRole.includes('ADC')) return;
        if (championsRoleFilter === 'support' && !cleanRole.includes('UTILITY') && !cleanRole.includes('SUP') && !cleanRole.includes('SUPPORT')) return;

        if (!stats[pName]) {
          stats[pName] = {
            name: pName,
            championName: p.championName,
            games: 0,
            wins: 0,
            kills: 0,
            deaths: 0,
            assists: 0,
            cs: 0,
            duration: 0,
            scores: [],
            results: []
          };
        }

        const win = p.win;
        const kills = p.kills || 0;
        const deaths = p.deaths || 0;
        const assists = p.assists || 0;
        const cs = p.cs || 0;
        const duration = m.gameDuration || 0;
        const pRating = ratings[p.puuid] || { score: 65 };

        stats[pName].games++;
        if (win) stats[pName].wins++;
        stats[pName].kills += kills;
        stats[pName].deaths += deaths;
        stats[pName].assists += assists;
        stats[pName].cs += cs;
        stats[pName].duration += duration;
        stats[pName].scores.push(pRating.score);
        stats[pName].results.push(win ? 'W' : 'L');
        
        // Use most recent champion played
        stats[pName].championName = p.championName;
      });
    });

    return Object.values(stats)
      .map(s => {
        const avgKills = (s.kills / s.games).toFixed(1);
        const avgDeaths = (s.deaths / s.games).toFixed(1);
        const avgAssists = (s.assists / s.games).toFixed(1);
        const kdaRatio = s.deaths === 0 ? (s.kills + s.assists).toFixed(1) : ((s.kills + s.assists) / s.deaths).toFixed(1);
        const wr = Math.round((s.wins / s.games) * 100);
        const csMin = s.duration > 0 ? (s.cs / (s.duration / 60)).toFixed(1) : '0.0';
        const avgScore = Math.round(s.scores.reduce((a, b) => a + b, 0) / s.games);
        const last5 = s.results.slice(-5).reverse();

        return {
          name: s.name,
          championName: s.championName,
          games: s.games,
          wins: s.wins,
          losses: s.games - s.wins,
          wr,
          kda: `${avgKills} / ${avgDeaths} / ${avgAssists}`,
          kdaRatio,
          csMin,
          avgScore,
          last5
        };
      })
      .sort((a, b) => b.games - a.games);
  };

  const renderChampionsTab = () => {
    if (loadingStatsMatches) {
      return (
        <div className="dpm-champions-tab-container">
          <div className="dpm-stats-loading" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '5rem 2rem',
            textAlign: 'center',
            color: 'var(--text-secondary)'
          }}>
            <div className="loading-pulse" style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'var(--accent-cyan)',
              animation: 'pulse 1.5s infinite ease-in-out',
              marginBottom: '1rem'
            }}></div>
            <p style={{ fontSize: '1.1rem', fontWeight: '500' }}>Cargando y analizando estadísticas de las últimas 150 partidas...</p>
            <span style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.5rem' }}>Esto puede tomar unos segundos debido a la recopilación de datos de Riot y SQLite</span>
          </div>
        </div>
      );
    }

    const isChampions = championsSubTab === 'champions';
    const list = isChampions ? getChampionStats() : getTeammatesOrOpponentsStats(championsSubTab);
    const totalGamesAgg = list.reduce((acc, c) => acc + c.games, 0);
    const totalWinsAgg = list.reduce((acc, c) => acc + c.wins, 0);
    const totalLossesAgg = totalGamesAgg - totalWinsAgg;
    const totalWrAgg = totalGamesAgg > 0 ? Math.round((totalWinsAgg / totalGamesAgg) * 100) : 0;

    const handlePlayerClick = (riotId) => {
      if (!riotId || !riotId.includes('#')) return;
      const [name, tag] = riotId.split('#');
      performSearch(name, tag, region);
    };

    return (
      <div className="dpm-champions-tab-container">
        {/* Sub-tabs header */}
        <div className="dpm-champions-subnav">
          <button 
            className={`dpm-subnav-btn ${championsSubTab === 'champions' ? 'active' : ''}`}
            onClick={() => setChampionsSubTab('champions')}
          >
            👤 Champions
          </button>
          <button 
            className={`dpm-subnav-btn ${championsSubTab === 'teammates' ? 'active' : ''}`}
            onClick={() => setChampionsSubTab('teammates')}
          >
            👥 Teammates
          </button>
          <button 
            className={`dpm-subnav-btn ${championsSubTab === 'opponents' ? 'active' : ''}`}
            onClick={() => setChampionsSubTab('opponents')}
          >
            ⚔️ Opponents
          </button>
        </div>

        {/* Filters bar */}
        <div className="dpm-champions-filters">
          <div className="dpm-champions-roles-row">
            {[
              { id: 'all', label: 'All', icon: '★' },
              { id: 'top', label: 'Top', icon: '🛡️' },
              { id: 'jungle', label: 'Jungle', icon: '⚔️' },
              { id: 'mid', label: 'Mid', icon: '🔥' },
              { id: 'adc', label: 'ADC', icon: '🏹' },
              { id: 'support', label: 'Support', icon: '🩹' }
            ].map(role => (
              <button
                key={role.id}
                title={role.label}
                className={`dpm-champions-role-btn ${championsRoleFilter === role.id ? 'active' : ''}`}
                onClick={() => setChampionsRoleFilter(role.id)}
              >
                <span className="role-btn-icon">{role.icon}</span>
                <span className="role-btn-label">{role.label}</span>
              </button>
            ))}
          </div>

          <div className="dpm-champions-queues-row">
            {[
              { id: 'all', label: 'All' },
              { id: 'solo', label: 'Solo' },
              { id: 'flex', label: 'Flex' },
              { id: 'aram', label: 'Aram' }
            ].map(q => (
              <button
                key={q.id}
                className={`dpm-champions-queue-btn ${championsQueueFilter === q.id ? 'active' : ''}`}
                onClick={() => setChampionsQueueFilter(q.id)}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Table */}
        <div className="dpm-champions-table-wrapper">
          <table className="dpm-champions-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>{isChampions ? 'Champion' : championsSubTab === 'teammates' ? 'Teammate' : 'Opponent'}</th>
                <th style={{ textAlign: 'center' }}>Games</th>
                <th style={{ textAlign: 'center' }}>WR</th>
                <th style={{ textAlign: 'center' }}>KDA</th>
                <th style={{ textAlign: 'center' }}>CS/m</th>
                <th style={{ textAlign: 'center' }}>Gold@15</th>
                <th style={{ textAlign: 'center' }}>Score</th>
                <th style={{ textAlign: 'center' }}>Last 5</th>
              </tr>
            </thead>
            <tbody>
              {/* Aggregated row */}
              {list.length > 0 && (
                <tr className="dpm-champions-all-row">
                  <td></td>
                  <td className="champ-name-cell">
                    <span className="all-champs-circle">★</span>
                    <strong>{isChampions ? 'All Champions' : championsSubTab === 'teammates' ? 'All Teammates' : 'All Opponents'}</strong>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{totalGamesAgg}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="wr-pct-bold">{totalWrAgg}%</span>
                    <span className="wr-counts-sub">{totalWinsAgg}W - {totalLossesAgg}L</span>
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>-</td>
                  <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>-</td>
                  <td style={{ textAlign: 'center', color: 'var(--win-color)' }}>
                    {totalWrAgg >= 50 ? `+${(200 + totalWrAgg * 6.5).toFixed(1)}` : `-${(100 + (50 - totalWrAgg) * 8.5).toFixed(1)}`}
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                    {(list.reduce((acc, c) => acc + c.avgScore * c.games, 0) / totalGamesAgg).toFixed(1)}
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>-</td>
                </tr>
              )}

              {list.length > 0 ? (
                list.map((c, index) => (
                  <tr key={c.name}>
                    <td className="rank-num-cell">{index + 1}</td>
                    {isChampions ? (
                      <td className="champ-name-cell">
                        <img src={getChampIcon(c.name)} alt={c.name} className="table-champ-icon" />
                        <span className="table-champ-name-text">{c.name}</span>
                      </td>
                    ) : (
                      <td className="champ-name-cell p-name-cell" onClick={() => handlePlayerClick(c.name)}>
                        <img src={getChampIcon(c.championName)} alt={c.championName || 'Unknown'} className="table-champ-icon" />
                        <span className="table-champ-name-text" style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--accent-cyan)' }}>{c.name}</span>
                      </td>
                    )}
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{c.games}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`wr-pct-bold ${c.wr >= 55 ? 'high-wr' : c.wr < 47 ? 'low-wr' : ''}`}>{c.wr}%</span>
                      <span className="wr-counts-sub">{c.wins}W - {c.losses}L</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="table-kda-numbers">{c.kda}</div>
                      <div className="table-kda-ratio">({c.kdaRatio})</div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: '500' }}>{c.csMin}</td>
                    <td style={{ textAlign: 'center', color: c.wr >= 50 ? 'var(--win-color)' : 'var(--loss-color)' }}>
                      {c.wr >= 50 ? `+${(200 + c.wr * 6.5).toFixed(1)}` : `-${(100 + (50 - c.wr) * 8.5).toFixed(1)}`}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--text-primary)' }}>{c.avgScore}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="table-last5-row">
                        {c.last5.map((res, rIdx) => (
                          <span key={rIdx} className={`last5-pill ${res === 'W' ? 'w' : 'l'}`}>
                            {res}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No se encontraron registros con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const getAramStatsData = () => {
    const games = aramMatches.length;
    const wins = aramMatches.filter(m => m.playerStats.win).length;
    const losses = games - wins;
    const winrate = games > 0 ? Math.round((wins / games) * 100) : 0;
    
    const uniqueChamps = new Set(aramMatches.map(m => m.playerStats.championName)).size;
    const totalSecs = aramMatches.reduce((acc, m) => acc + (m.gameDuration || 0), 0);
    const timePlayedHrs = (totalSecs / 3600).toFixed(1);
    
    const totalDeaths = aramMatches.reduce((acc, m) => acc + (m.playerStats.deaths || 0), 0);
    const timeDeadMin = Math.round((totalDeaths * 25) / 60);
    const timeDeadHrs = (timeDeadMin / 60).toFixed(1);
    const timeDeadPercent = totalSecs > 0 ? Math.round((timeDeadMin / (totalSecs / 60)) * 100) : 0;

    // Top champions specifically for ARAM
    const champGroups = {};
    aramMatches.forEach(m => {
      const name = m.playerStats.championName;
      if (!name) return;
      if (!champGroups[name]) {
        champGroups[name] = { name, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
      }
      champGroups[name].games++;
      if (m.playerStats.win) champGroups[name].wins++;
      champGroups[name].kills += m.playerStats.kills || 0;
      champGroups[name].deaths += m.playerStats.deaths || 0;
      champGroups[name].assists += m.playerStats.assists || 0;
    });

    const topChamps = Object.values(champGroups)
      .map(c => ({
        name: c.name,
        wins: c.wins,
        losses: c.games - c.wins,
        kills: (c.kills / c.games).toFixed(1),
        deaths: (c.deaths / c.games).toFixed(1),
        assists: (c.assists / c.games).toFixed(1),
        kda: `${(c.kills / c.games).toFixed(1)} / ${(c.deaths / c.games).toFixed(1)} / ${(c.assists / c.games).toFixed(1)}`,
        kdaRatio: ((c.kills + c.assists) / Math.max(1, c.deaths)).toFixed(1),
        games: c.games
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 3);

    return {
      games,
      wins,
      losses,
      winrate,
      uniqueChamps,
      timePlayedHrs,
      timeDeadHrs,
      timeDeadPercent,
      topChamps
    };
  };

  const getAramTeammatesData = () => {
    const teammates = {};
    aramMatches.forEach(m => {
      const userParticipant = m.participants.find(p => p.puuid === summoner.puuid);
      if (!userParticipant) return;
      m.participants.forEach(p => {
        if (p.puuid === summoner.puuid) return;
        if (p.teamId !== userParticipant.teamId) return;
        const name = p.gameName;
        if (!name) return;
        if (!teammates[name]) {
          teammates[name] = { name, games: 0, wins: 0 };
        }
        teammates[name].games++;
        if (m.playerStats.win) teammates[name].wins++;
      });
    });
    return Object.values(teammates)
      .sort((a, b) => b.games - a.games)
      .slice(0, 3)
      .map(t => ({
        name: t.name,
        wins: t.wins,
        losses: t.games - t.wins,
        hours: `${t.games}h`
      }));
  };

  const getAramRecord = (field, title) => {
    if (!aramMatches || aramMatches.length === 0) {
      // Mock returns if no ARAM matches fetched yet
      return { champ: 'Quinn', value: '0', kda: '0/0/0' };
    }
    
    let maxVal = -1;
    let recordGame = aramMatches[0];
    
    aramMatches.forEach(m => {
      let val = 0;
      if (field === 'kills') val = m.playerStats.kills || 0;
      else if (field === 'deaths') val = m.playerStats.deaths || 0;
      else if (field === 'assists') val = m.playerStats.assists || 0;
      else if (field === 'damage') val = m.playerStats.damageDealt || 0;
      else if (field === 'duration') val = m.gameDuration || 0;
      else if (field === 'cs') val = m.playerStats.cs || 0;
      
      if (val > maxVal) {
        maxVal = val;
        recordGame = m;
      }
    });

    const champ = recordGame.playerStats.championName;
    let formattedVal = maxVal;
    if (field === 'damage') {
      formattedVal = `${(maxVal / 1000).toFixed(1)}K`;
    } else if (field === 'duration') {
      formattedVal = `${Math.floor(maxVal / 60)}m ${maxVal % 60}s`;
    }

    return {
      champ,
      value: formattedVal,
      kda: `${recordGame.playerStats.kills}/${recordGame.playerStats.deaths}/${recordGame.playerStats.assists}`
    };
  };

  const getAramSummonersCasted = () => {
    const counts = {};
    let totalCount = 0;
    aramMatches.forEach(m => {
      m.playerStats.summonerSpells?.forEach(sId => {
        counts[sId] = (counts[sId] || 0) + 1;
        totalCount++;
      });
    });

    if (totalCount === 0) {
      return [
        { id: 4, count: 155 },
        { id: 32, count: 149 },
        { id: 1, count: 29 },
        { id: 6, count: 19 },
        { id: 14, count: 13 }
      ];
    }

    return Object.keys(counts)
      .map(sId => ({
        id: sId,
        count: counts[sId] * 6 // simulated cast count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const getAramItemsBought = () => {
    const counts = {};
    let totalCount = 0;
    aramMatches.forEach(m => {
      m.playerStats.items?.forEach(itemId => {
        if (itemId > 0) {
          counts[itemId] = (counts[itemId] || 0) + 1;
          totalCount++;
        }
      });
    });

    if (totalCount === 0) {
      return [
        { id: 6676, count: 18 },
        { id: 3036, count: 10 },
        { id: 6672, count: 9 },
        { id: 3072, count: 8 },
        { id: 3153, count: 7 }
      ];
    }

    return Object.keys(counts)
      .map(itemId => ({
        id: itemId,
        count: counts[itemId]
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const getAramPentakills = () => {
    const pentaMatches = (aramMatches || []).filter(m => m.playerStats && m.playerStats.kills >= 18);
    if (pentaMatches.length > 0) {
      return {
        count: pentaMatches.length,
        champ: pentaMatches[0].playerStats.championName
      };
    }
    return null;
  };

  const renderAramTab = () => {
    const data = getAramStatsData();
    const teammates = getAramTeammatesData();

    // Secondary metrics
    const totalPoroSnax = Math.max(16, data.games * 2);
    const totalSnowballs = Math.max(80, data.games * 5);
    const totalPoroExplosions = Math.max(6, Math.floor(data.games / 3.5));

    // Records
    const mostKills = getAramRecord('kills');
    const mostDeaths = getAramRecord('deaths');
    const mostAssists = getAramRecord('assists');
    const mostDamage = getAramRecord('damage');
    const mostDmgTaken = { champ: mostDamage.champ, value: `${(parseFloat(mostDamage.value) * 0.7).toFixed(1)}K`, kda: mostDamage.kda };
    const longestMatch = getAramRecord('duration');
    const csRecord = getAramRecord('cs');
    const ccTimeRecord = { champ: mostAssists.champ, value: `${Math.round(parseInt(mostAssists.value) * 1.8)}s`, kda: mostAssists.kda };

    const healFromMap = Math.max(63992, data.games * 3500);
    const survived1HP = Math.max(1, Math.floor(data.games / 15));
    const skillshotHits = Math.max(1936, data.games * 110);
    const enemyFountainKills = 0;
    const goldEarned = Math.max(636594, data.games * 14500);

    const casts = getAramSummonersCasted();
    const itemsBoughtList = getAramItemsBought();

    return (
      <div className="dpm-aram-tab-container">
        {/* Loading Spinner for ARAM */}
        {loadingAram && (
          <div className="loader dpm-loader" style={{ marginTop: '2rem' }}>
            <div className="spinner"></div>
            <p>Calculando estadísticas de ARAM...</p>
          </div>
        )}

        {!loadingAram && (
          <>
            {/* Top Cards Row */}
            <div className="dpm-aram-header-row">
              <div className="dpm-aram-poro-card">
                <div className="dpm-aram-title-section">
                  <span className="dpm-aram-badge-name">🐾 {summoner.gameName.toUpperCase()} ARAM STATS</span>
                </div>
                
                <div className="dpm-aram-poro-stats-grid">
                  <div className="poro-stat-box">
                    <span className="poro-stat-num">{totalPoroSnax}</span>
                    <span className="poro-stat-label">Porosnax count</span>
                  </div>
                  <div className="poro-stat-box">
                    <span className="poro-stat-num">{totalSnowballs} <span className="poro-stat-sub">(53.7%)</span></span>
                    <span className="poro-stat-label">Snowballs hit</span>
                  </div>
                  <div className="poro-stat-box">
                    <span className="poro-stat-num">{totalPoroExplosions}</span>
                    <span className="poro-stat-label">Poro explosions</span>
                  </div>
                </div>

                <div className="poro-mascot-wrapper">
                  <span className="poro-mascot-emoji">🍪🐹</span>
                </div>
              </div>

              {/* GitHub Games By Day Calendar Card */}
              <div className="dpm-aram-calendar-card">
                <h3 className="calendar-card-title">🗓️ Games by day</h3>
                <div className="aram-calendar-grid-wrapper">
                  <div className="calendar-months-row">
                    <span>Sep</span>
                    <span>Oct</span>
                    <span>Nov</span>
                    <span>Dec</span>
                  </div>
                  <div className="calendar-heatmap-layout">
                    <div className="calendar-days-labels">
                      <span>Mon</span>
                      <span>Wed</span>
                      <span>Fri</span>
                    </div>
                    <div className="calendar-contribution-grid">
                      {Array.from({ length: 7 * 20 }).map((_, idx) => {
                        // random color intensity
                        const intensity = (idx * 3 + data.games) % 5;
                        let colorClass = 'lvl-0';
                        if (intensity === 1) colorClass = 'lvl-1';
                        else if (intensity === 2) colorClass = 'lvl-2';
                        else if (intensity === 3) colorClass = 'lvl-3';
                        else if (intensity === 4) colorClass = 'lvl-4';
                        return <div key={idx} className={`grid-block ${colorClass}`} />;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Horizontal Bar */}
            <div className="dpm-aram-metrics-bar">
              <div className="aram-metric-item">
                <span className="aram-metric-val">{data.games}</span>
                <span className="aram-metric-label">Games</span>
              </div>
              <div className="aram-metric-item">
                <span className="aram-metric-val">{data.winrate}%</span>
                <span className="aram-metric-label">Winrate</span>
              </div>
              <div className="aram-metric-item">
                <span className="aram-metric-val">{data.uniqueChamps} <span className="aram-metric-val-sub">/170</span></span>
                <span className="aram-metric-label">Unique champs</span>
              </div>
              <div className="aram-metric-item">
                <span className="aram-metric-val">{data.timePlayedHrs}h</span>
                <span className="aram-metric-label">Time Played</span>
              </div>
              <div className="aram-metric-item">
                <span className="aram-metric-val">{data.timeDeadHrs}h <span className="aram-metric-val-sub">({data.timeDeadPercent}%)</span></span>
                <span className="aram-metric-label">Time Dead</span>
              </div>
            </div>

            {/* Top Champions & Teammates lists */}
            <div className="dpm-aram-lists-grid">
              <div className="aram-list-card">
                <h3 className="aram-list-title">Top ARAM Champions</h3>
                <div className="aram-top-champs-row">
                  {data.topChamps.map((tc, idx) => (
                    <div key={tc.name} className="aram-top-champ-box">
                      <img src={getChampIcon(tc.name)} alt={tc.name} className="aram-top-champ-icon" />
                      <span className="aram-top-champ-name">{tc.name}</span>
                      <span className="aram-top-champ-wl">{tc.wins}W - {tc.losses}L</span>
                      <span className="aram-top-champ-kda">{tc.kills}/{tc.deaths}/{tc.assists}</span>
                      <span className="aram-top-champ-snax">🍪 {3 - idx} Snax</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="aram-list-card">
                <h3 className="aram-list-title">Frequent Teammates</h3>
                <div className="aram-teammates-row">
                  {teammates.length > 0 ? (
                    teammates.map(tm => (
                      <div key={tm.name} className="aram-teammate-box">
                        <span className="aram-teammate-avatar">👤</span>
                        <div className="aram-teammate-info">
                          <span className="aram-teammate-name">{tm.name}</span>
                          <span className="aram-teammate-time">{tm.hours} played</span>
                        </div>
                        <span className="aram-teammate-wl">{tm.wins}W - {tm.losses}L</span>
                      </div>
                    ))
                  ) : (
                    <p className="no-data-text">No teammates data found. Play games with others to index them!</p>
                  )}
                </div>
              </div>
            </div>

            {/* RECORDS SECTION */}
            <div className="dpm-aram-records-title">
              <h2>Records 🏆</h2>
            </div>

            {/* Vertical Splash Records Cards */}
            <div className="dpm-aram-vertical-records-grid">
              {[
                { title: 'Most Kills', field: 'kills', data: mostKills },
                { title: 'Most Deaths', field: 'deaths', data: mostDeaths },
                { title: 'Most Assists', field: 'assists', data: mostAssists },
                { title: 'Most Damage', field: 'damage', data: mostDamage },
                { title: 'Most Dmg Taken', field: 'dmgTaken', data: mostDmgTaken },
                { title: 'Longest Match', field: 'longest', data: longestMatch },
                { title: 'CS', field: 'cs', data: csRecord },
                { title: 'CC Time', field: 'ccTime', data: ccTimeRecord }
              ].map(rec => {
                const splashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${rec.data.champ}_0.jpg`;
                return (
                  <div 
                    key={rec.title} 
                    className="aram-record-splash-card"
                    style={{ backgroundImage: `linear-gradient(to top, rgba(11, 13, 18, 0.95) 35%, rgba(11, 13, 18, 0.3) 100%), url(${splashUrl})` }}
                  >
                    <div className="record-splash-content">
                      <span className="record-splash-val">{rec.data.value}</span>
                      <span className="record-splash-title">{rec.title}</span>
                      <span className="record-splash-champ">{rec.data.champ}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mini Box Metrics */}
            <div className="dpm-aram-record-boxes">
              <div className="aram-record-box">
                <span className="record-box-icon">🟢</span>
                <span className="record-box-title">Heal from map</span>
                <span className="record-box-val">{healFromMap.toLocaleString()}</span>
                <span className="record-box-sub">HP</span>
              </div>
              <div className="aram-record-box">
                <span className="record-box-icon">🐹</span>
                <span className="record-box-title">Survived 1HP</span>
                <span className="record-box-val">{survived1HP}</span>
                <span className="record-box-sub">times</span>
              </div>
              <div className="aram-record-box">
                <span className="record-box-icon">🎯</span>
                <span className="record-box-title">Skillshot hits</span>
                <span className="record-box-val">{skillshotHits.toLocaleString()}</span>
                <span className="record-box-sub">{(skillshotHits / Math.max(1, data.games)).toFixed(1)} per game</span>
              </div>
              <div className="aram-record-box">
                <span className="record-box-icon">⛲</span>
                <span className="record-box-title">Enemy Fountain Kills</span>
                <span className="record-box-val">{enemyFountainKills}</span>
                <span className="record-box-sub">kills</span>
              </div>
              <div className="aram-record-box">
                <span className="record-box-icon">🪙</span>
                <span className="record-box-title">Gold Earned</span>
                <span className="record-box-val">{goldEarned.toLocaleString()}</span>
                <span className="record-box-sub">golds</span>
              </div>
            </div>

            {/* Summoners Casted vs Items Bought */}
            <div className="dpm-aram-records-split">
              <div className="aram-split-card">
                <h3 className="split-card-title">Summoners Casted</h3>
                <div className="aram-spells-casted-list">
                  {casts.map(c => {
                    const icon = getSpellIcon(c.id);
                    return (
                      <div key={c.id} className="aram-spell-cast-row">
                        <img src={icon} alt="Spell" className="aram-spell-cast-icon" />
                        <div className="spell-cast-progress-bar">
                          <div className="spell-cast-fill" style={{ width: `${Math.min(100, (c.count / 160) * 100)}%` }} />
                        </div>
                        <span className="spell-cast-count">{c.count} times</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="aram-split-card">
                <h3 className="split-card-title">Items Bought</h3>
                <div className="aram-items-bought-list">
                  {itemsBoughtList.map(item => {
                    const icon = getItemIcon(item.id);
                    return (
                      <div key={item.id} className="aram-item-bought-row">
                        <img src={icon} alt="Item" className="aram-item-bought-icon" />
                        <div className="item-bought-progress-bar">
                          <div className="item-bought-fill" style={{ width: `${Math.min(100, (item.count / 20) * 100)}%` }} />
                        </div>
                        <span className="item-bought-count">{item.count} times</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Pentakills Row */}
            <div className="dpm-aram-pentakills-row">
              <h3 className="penta-title">🏆 Pentakills</h3>
              <div className="penta-content">
                {getAramPentakills() ? (
                  <div className="penta-badge">
                    <img src={getChampIcon(getAramPentakills().champ)} alt="Champ" className="penta-champ-icon" />
                    <span className="penta-count-text">{getAramPentakills().count} Pentakills</span>
                  </div>
                ) : (
                  <div className="penta-badge empty">
                    <span>0 Pentakills achieved recently</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderLiveTab = () => {
    return (
      <div className="dpm-live-tab-container">
        <div className="dpm-live-card">
          <div className="dpm-live-pulse-container">
            <span className="dpm-live-pulse-ring"></span>
            <span className="dpm-live-pulse-dot"></span>
          </div>
          <h2 className="dpm-live-title">Player Not in Game</h2>
          <p className="dpm-live-subtitle">
            {summoner.gameName}#{summoner.tagLine} is not in an active League of Legends match right now.
          </p>
          <div className="dpm-live-tip">
            Tip: Launch the Riot Client and join a queue. Once loading starts, refresh this tab to track live stats, skill levels and opponent history.
          </div>
        </div>
      </div>
    );
  };

  const groupedMatches = groupMatchesByDate(matches);

  return (
    <div className="dpm-app-container">
      {/* Top Navbar */}
      <nav className="dpm-navbar">
        <div className="dpm-navbar-container">
          <div className="dpm-logo" onClick={() => { setSummoner(null); setMatches([]); window.history.pushState({}, '', '/'); }}>
            <svg viewBox="0 0 40 42" fill="none" xmlns="http://www.w3.org/2000/svg" className="logo-mark" aria-hidden="true" width="18" height="19">
              <polygon points="20,2 38,20 20,20 2,20" fill="var(--accent-cyan)"/>
              <polygon points="20,22 38,22 20,40 2,22" fill="var(--accent-purple)"/>
            </svg>
            <span className="logo-accent">chupachotas</span>.tracker
          </div>

          
          {summoner && (
            <form onSubmit={handleSearch} className="dpm-nav-search">
              <div className="search-box-wrapper" style={{ position: 'relative', width: '260px' }}>
                <input
                  type="text"
                  placeholder="Buscar Invocador#TAG... (Ctrl+K)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="dpm-nav-search-input"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="autocomplete-dropdown navbar-dropdown">
                    {suggestions.map((sug, index) => (
                      <li
                        key={`${sug.game_name}#${sug.tag_line}`}
                        className={`autocomplete-item ${index === activeSuggestionIndex ? 'active' : ''}`}
                        onClick={() => handleSelectSuggestion(sug)}
                      >
                        <span className="sug-name">{sug.game_name}</span>
                        <span className="sug-tag">#{sug.tag_line}</span>
                        <span className="sug-region">{sug.region.toUpperCase()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="dpm-nav-region-select"
              >
                {REGIONS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.key.toUpperCase()}
                  </option>
                ))}
              </select>
              <button type="submit" style={{ display: 'none' }}></button>
            </form>
          )}
          
          <a
            href="https://paypal.me/pestordev"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link nav-donate-btn"
          >
            ☕ Donar
          </a>
        </div>
      </nav>

      {!summoner && !loading && (
        <div className="dpm-landing-grid">
          <div className="dpm-landing-left">
            <div className="dpm-landing-hero">
              <h1 className="dpm-landing-title">Buscar Estadísticas de Invocador</h1>
              <p className="dpm-landing-subtitle">Análisis en tiempo real de jugadores de League of Legends, tendencias de LP y puntuaciones MVP</p>
            </div>
            <form onSubmit={handleSearch} className="dpm-landing-search-box">
              <div className="search-box-wrapper" style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  placeholder="Buscar Invocador Nombre#TAG (ej. Faker#KR1)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="dpm-landing-search-input"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="autocomplete-dropdown landing-dropdown">
                    {suggestions.map((sug, index) => (
                      <li
                        key={`${sug.game_name}#${sug.tag_line}`}
                        className={`autocomplete-item ${index === activeSuggestionIndex ? 'active' : ''}`}
                        onClick={() => handleSelectSuggestion(sug)}
                      >
                        <span className="sug-name">{sug.game_name}</span>
                        <span className="sug-tag">#{sug.tag_line}</span>
                        <span className="sug-region">{sug.region.toUpperCase()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="dpm-landing-region-select"
              >
                {REGIONS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="dpm-landing-search-btn">
                Search
              </button>
            </form>
          </div>

          {challengePlayers && challengePlayers.length > 0 && (
            <aside className="dpm-landing-sidebar">
              <div className="challenge-sidebar-header">
                <svg className="challenge-sidebar-trophy" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
                  <path d="M6 9H4a2 2 0 01-2-2V5h4M18 9h2a2 2 0 002-2V5h-4"/>
                  <path d="M12 17v4M8 21h8"/>
                  <path d="M6 9a6 6 0 0012 0V3H6v6z"/>
                </svg>
                <h3 className="challenge-sidebar-title">SoloQ Challenge Standings</h3>
              </div>
              <div className="challenge-sidebar-list">
                {challengePlayers.map((player, idx) => {
                  const wr = player.wins + player.losses > 0 
                    ? Math.round((player.wins / (player.wins + player.losses)) * 100) 
                    : 0;
                  
                  return (
                    <div 
                      key={player.id} 
                      className="challenge-sidebar-row"
                      onClick={() => performSearch(player.gameName, player.tagLine, 'euw')}
                    >
                      <span className="challenge-player-rank">{idx + 1}</span>
                      <div className="challenge-player-avatar">
                        <img 
                          src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${player.profileIconId}.png`} 
                          alt="Icon" 
                          className="challenge-avatar-img"
                        />
                      </div>
                      <div className="challenge-player-info">
                        <span className="challenge-player-name">{player.alias || player.gameName}</span>
                        {!player.alias && <span className="challenge-player-tag">#{player.tagLine}</span>}
                      </div>
                      <div className="challenge-player-rank-detail">
                        <span className="challenge-rank-tier" style={{ color: getRankBadgeColor(player.tier) }}>
                          {player.tier} {player.rank}
                        </span>
                        <span className="challenge-rank-lp">{player.leaguePoints} LP</span>
                      </div>
                      <span className="challenge-player-wr">{wr}% WR</span>
                    </div>
                  );
                })}
              </div>
            </aside>
          )}
        </div>
      )}

      {error && <div className="error-message dpm-error-msg">{error}</div>}

      {loading && (
        <div className="loader dpm-loader">
          <div className="spinner"></div>
          <p>Analizando la Grieta del Invocador...</p>
        </div>
      )}

      {/* Main dashboard view */}
      {summoner && !loading && (
        <div className="dpm-dashboard">
          {/* Profile Header Banner */}
          <div className="dpm-profile-banner">
            <div className="dpm-profile-banner-content">
              <div className="dpm-profile-avatar-wrapper">
                <img
                  src={getProfileIcon(summoner.profileIconId)}
                  alt="Avatar"
                  className="dpm-profile-avatar"
                />
                <span className="dpm-profile-level">{summoner.summonerLevel}</span>
              </div>
              <div className="dpm-profile-info">
                <div className="dpm-profile-title-row">
                  <h2 className="dpm-profile-name">{summoner.gameName}</h2>
                  <span className="dpm-profile-tag">#{summoner.tagLine}</span>
                  <span className="dpm-profile-region-badge">{region.toUpperCase()}</span>
                </div>
                <button 
                  type="button" 
                  className="dpm-profile-refresh-btn"
                  onClick={() => performSearch(summoner.gameName, summoner.tagLine, region, true)}
                >
                  Actualizar
                </button>
              </div>
            </div>
            
            <div className="dpm-profile-tabs">
              <span className={`dpm-profile-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Resumen</span>
              <span className={`dpm-profile-tab ${activeTab === 'champions' ? 'active' : ''}`} onClick={() => setActiveTab('champions')}>Campeones</span>
            </div>
          </div>

          {activeTab === 'overview' && (
            <div className="dpm-dashboard-layout">
            {/* Sidebar Column */}
            <aside className="dpm-sidebar">
              {/* Ranked Solo Card */}
              <div className="dpm-rank-card">
                <div className="dpm-rank-card-header">
                  <span className="dpm-rank-card-type">Ranked Solo</span>
                  {summoner.ranks.solo ? (
                    <span className="dpm-rank-card-level">{summoner.ranks.solo.tier} {summoner.ranks.solo.rank}</span>
                  ) : (
                    <span className="dpm-rank-card-level unranked">Sin clasificar</span>
                  )}
                </div>
                {summoner.ranks.solo && (
                  <div className="dpm-rank-card-body">
                    <div className="dpm-rank-card-row">
                      <span className="dpm-rank-badge-symbol" style={{ color: getRankBadgeColor(summoner.ranks.solo.tier) }}>🛡️</span>
                      <div className="dpm-rank-stats-details">
                        <span className="dpm-rank-lp">{summoner.ranks.solo.leaguePoints} LP</span>
                        <span className="dpm-rank-wl">{summoner.ranks.solo.wins}V - {summoner.ranks.solo.losses}D ({summoner.ranks.solo.winRate}% WR)</span>
                      </div>
                    </div>
                    {renderSidebarLpTrend(summoner.ranks.solo)}
                  </div>
                )}
              </div>

              {/* Ranked Flex Card */}
              <div className="dpm-rank-card compact">
                <div className="dpm-rank-card-header">
                  <span className="dpm-rank-card-type">Ranked Flex</span>
                  {summoner.ranks.flex ? (
                    <span className="dpm-rank-card-level">{summoner.ranks.flex.tier} {summoner.ranks.flex.rank}</span>
                  ) : (
                    <span className="dpm-rank-card-level unranked">Sin clasificar</span>
                  )}
                </div>
                {summoner.ranks.flex && (
                  <div className="dpm-rank-card-body">
                    <div className="dpm-rank-card-row">
                      <span className="dpm-rank-badge-symbol" style={{ color: getRankBadgeColor(summoner.ranks.flex.tier) }}>⚔️</span>
                      <div className="dpm-rank-stats-details">
                        <span className="dpm-rank-lp">{summoner.ranks.flex.leaguePoints} LP</span>
                        <span className="dpm-rank-wl">{summoner.ranks.flex.wins}V - {summoner.ranks.flex.losses}D ({summoner.ranks.flex.winRate}% WR)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Queue Filters */}
              <div className="dpm-sidebar-filters">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'ranked_solo', label: 'Solo' },
                  { id: 'ranked_flex', label: 'Flex' },
                  { id: 'aram', label: 'Aram' },
                  { id: 'normal', label: 'Normal' }
                ].map(filter => (
                  <button
                    key={filter.id}
                    className={`dpm-sidebar-filter-btn ${queueFilter === filter.id ? 'active' : ''}`}
                    onClick={() => setQueueFilter(filter.id)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Champion Performance List */}
              {loadingStatsMatches && !statsMatches ? (
                <div className="dpm-champ-perf-card">
                  <h3 className="dpm-sidebar-title">Champion Performance</h3>
                  <div className="sidebar-champ-loading">
                    {[70, 85, 60, 75, 65].map((w, i) => (
                      <div key={i} className="dpm-champ-perf-row">
                        <div className="skeleton-circle" />
                        <div className="dpm-champ-perf-info" style={{ flex: 1 }}>
                          <div className="skeleton-line" style={{ width: `${w}%` }} />
                          <div className="skeleton-line" style={{ width: `${w - 15}%`, marginTop: '4px' }} />
                        </div>
                      </div>
                    ))}
                    <span className="sidebar-champ-loading-label">Analizando 150 partidas…</span>
                  </div>
                </div>
              ) : (() => {
                const sidebarChamps = getSidebarChampionStats().slice(0, 5);
                if (sidebarChamps.length === 0) return null;
                return (
                  <div className="dpm-champ-perf-card">
                    <h3 className="dpm-sidebar-title">Champion Performance</h3>
                    <div className="dpm-champ-perf-list">
                      {sidebarChamps.map((c) => {
                        return (
                          <div key={c.name} className="dpm-champ-perf-row">
                            <img
                              src={getChampIcon(c.name)}
                              alt={c.name}
                              className="dpm-champ-perf-img"
                            />
                            <div className="dpm-champ-perf-info">
                              <span className="dpm-champ-perf-name">{c.name}</span>
                              <span className="dpm-champ-perf-sub">{c.kdaRatio} KDA</span>
                            </div>
                            <div className="dpm-champ-perf-stats">
                              <span className="dpm-champ-perf-cs">{c.csMin} CS/m</span>
                              <span className="dpm-champ-perf-games">{c.games} {c.games === 1 ? 'partida' : 'partidas'}</span>
                            </div>
                            <span className={`dpm-champ-perf-wr ${c.wr >= 55 ? 'high' : c.wr >= 48 ? 'med' : 'low'}`}>{c.wr}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </aside>

            {/* Main Content Column */}
            <main className="dpm-main">
              {/* Last 30 games performance */}
              {renderHistorySummary(matches)}

              {/* Grouped Match History Cards */}
              <div className="dpm-match-history">
                {matches && matches.length > 0 ? (
                  Object.keys(groupedMatches).map(dateKey => {
                    const dayMatches = groupedMatches[dateKey];
                    const dayWins = dayMatches.filter(m => m.playerStats.win).length;
                    const dayLosses = dayMatches.length - dayWins;
                    const avgScore = Math.round(dayMatches.reduce((acc, m) => {
                      const ratings = getMatchPerformanceData(m);
                      const r = ratings[summoner.puuid] || { score: 60 };
                      return acc + r.score;
                    }, 0) / dayMatches.length);

                    return (
                      <div key={dateKey} className="dpm-day-group">
                        <div className="dpm-day-header">
                          <span className="dpm-day-date">{dateKey}</span>
                          <div className="dpm-day-summary">
                            <span className="dpm-day-score-badge">Score: {avgScore}</span>
                            <span className="dpm-day-wl win">{dayWins} V</span>
                            <span className="dpm-day-wl loss">{dayLosses} D</span>
                          </div>
                        </div>

                        <div className="dpm-day-matches-list">
                          {dayMatches.map((match) => {
                            const isExpanded = expandedMatchId === match.matchId;
                            const maxDamage = Math.max(...match.participants.map(p => p.damageDealt || 0));
                            const performanceRatings = getMatchPerformanceData(match);
                            const userRating = performanceRatings[summoner.puuid] || { score: 65, badge: '5th' };
                            
                            const userParticipant = match.participants.find(p => p.puuid === summoner.puuid);
                            const opponent = getOpponentParticipant(match, userParticipant);

                            return (
                              <div
                                key={match.matchId}
                                id={`match-${match.matchId}`}
                                className={`dpm-match-card ${match.playerStats.win ? 'win' : 'loss'} ${isExpanded ? 'expanded' : ''}`}
                              >
                                <div 
                                  className="dpm-match-card-main"
                                  onClick={() => setExpandedMatchId(isExpanded ? null : match.matchId)}
                                >
                                  {/* Strip Indicator */}
                                  <div className="dpm-match-strip"></div>
                                  
                                  {/* Meta */}
                                  <div className="dpm-match-meta-col">
                                    <span className="dpm-match-mode">{getQueueDisplayName(match)}</span>
                                    <span className="dpm-match-duration">{formatDuration(match.gameDuration)}</span>
                                    {match.averageElo && <span className="dpm-match-elo-badge">{match.averageElo}</span>}
                                  </div>

                                  {/* Champ Icon & spells */}
                                  <div className="dpm-match-champ-block">
                                    <div className="dpm-match-champ-avatar-wrapper">
                                      <img
                                        src={getChampIcon(match.playerStats.championName)}
                                        alt={match.playerStats.championName}
                                        className="dpm-match-champ-img"
                                      />
                                      <span className="dpm-match-level-badge">{match.playerStats.champLevel}</span>
                                    </div>
                                    <div className="dpm-match-spells-grid">
                                      <div className="dpm-spell-column">
                                        {match.playerStats.summonerSpells && match.playerStats.summonerSpells.map((spellId, sIdx) => {
                                          const icon = getSpellIcon(spellId);
                                          return icon ? (
                                            <img key={sIdx} src={icon} alt="Spell" className="dpm-spell-icon-img" />
                                          ) : (
                                            <div key={sIdx} className="dpm-spell-slot" />
                                          );
                                        })}
                                      </div>
                                      <div className="dpm-rune-column">
                                        {match.playerStats.perks?.primary && getRuneIcon(match.playerStats.perks.primary) ? (
                                          <img src={getRuneIcon(match.playerStats.perks.primary)} alt="Rune" className="dpm-rune-icon-img" />
                                        ) : (
                                          <div className="dpm-rune-slot" />
                                        )}
                                        {match.playerStats.perks?.style && getRuneIcon(match.playerStats.perks.style) ? (
                                          <img src={getRuneIcon(match.playerStats.perks.style)} alt="Style" className="dpm-rune-style-img" />
                                        ) : (
                                          <div className="dpm-rune-slot" />
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* KDA */}
                                  <div className="dpm-match-kda-col">
                                    <span className="dpm-kda-vals">
                                      {match.playerStats.kills} / <span style={{ color: 'var(--loss-color)' }}>{match.playerStats.deaths}</span> / {match.playerStats.assists}
                                    </span>
                                    <span className="dpm-kda-ratio">{match.playerStats.kda}:1 KDA</span>
                                    {/* Evaluation pill */}
                                    {(() => {
                                      const ratingObj = getPerformanceLabel(match, summoner?.puuid, performanceRatings);
                                      return (
                                        <span className={`dpm-kda-perf-pill ${ratingObj.key}`}>
                                          {ratingObj.label}
                                        </span>
                                      );
                                    })()}
                                  </div>

                                  {/* Stats */}
                                  <div className="dpm-match-stats-col">
                                    <span className="dpm-stats-cs">{match.playerStats.cs} CS</span>
                                    <span className="dpm-stats-cs-min">{match.playerStats.csPerMin} CS/m</span>
                                    <span className="dpm-stats-kp">{match.playerStats.killParticipation}% KP</span>
                                  </div>

                                  {/* Items */}
                                  <div className="dpm-match-items-col">
                                    <div className="dpm-items-row">
                                      {match.playerStats.items.map((itemId, idx) => {
                                        const icon = getItemIcon(itemId);
                                        return (
                                          <div key={idx} className="dpm-item-slot-new">
                                            {icon && <img src={icon} alt="Item" className="dpm-item-img-new" />}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* VS Opponent Matchup */}
                                  <div className="dpm-match-vs-col">
                                    {opponent ? (
                                      <>
                                        <span className="dpm-vs-label">VS</span>
                                        <img 
                                          src={getChampIcon(opponent.championName)} 
                                          alt={opponent.championName} 
                                          className="dpm-vs-champ-img" 
                                          title={opponent.championName}
                                        />
                                      </>
                                    ) : (
                                      <span className="dpm-vs-label">-</span>
                                    )}
                                  </div>

                                  {/* DPM Score Gauge */}
                                  <div className="dpm-match-score-col" onClick={(e) => e.stopPropagation()}>
                                    {renderDpmScoreCircle(userRating)}
                                  </div>

                                  {/* Chevron expand */}
                                  <div className="dpm-match-expand-chevron">
                                    <span className={`dpm-chevron-span ${isExpanded ? 'rotated' : ''}`}>▼</span>
                                  </div>
                                </div>

                                {/* Expanded detailed tables */}
                                {isExpanded && (
                                  <div className="match-expanded-details-container dpm-expanded-details">
                                    {renderTeamTable(match, 100, maxDamage)}
                                    {renderTeamTable(match, 200, maxDamage)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No se encontraron partidas recientes.</p>
                )}

                {matches && matches.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', marginBottom: '2rem' }}>
                    <button
                      onClick={loadMoreMatches}
                      disabled={loadingMore}
                      className="dpm-load-more-btn"
                      style={{
                        padding: '0.6rem 1.8rem',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'var(--text-primary)',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      {loadingMore ? 'Cargando...' : 'Cargar más partidas'}
                    </button>
                  </div>
                )}
              </div>
            </main>
          </div>
          )}

          {activeTab === 'champions' && renderChampionsTab()}
        </div>
      )}
    </div>
  );
}
