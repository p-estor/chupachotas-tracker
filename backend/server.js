require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const db = require('./db');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connection to soloq_challenge SQLite database for Leaderboard integration
const challengeDbPath = process.env.CHALLENGE_DB_PATH || path.resolve(__dirname, '../../soloq_challenge/dev.db');
const challengeDb = new sqlite3.Database(challengeDbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error connecting to soloq_challenge SQLite database:', err.message);
  } else {
    console.log('Connected to soloq_challenge SQLite database successfully.');
  }
});


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const RIOT_API_KEY = process.env.RIOT_API_KEY;

// Region to routing maps
const regionConfig = {
  euw: { platform: 'euw1', route: 'europe' },
  eune: { platform: 'eun1', route: 'europe' },
  na: { platform: 'na1', route: 'americas' },
  lan: { platform: 'la1', route: 'americas' },
  las: { platform: 'la2', route: 'americas' },
  kr: { platform: 'kr', route: 'asia' },
  br: { platform: 'br1', route: 'americas' },
  jp: { platform: 'jp1', route: 'asia' },
  oce: { platform: 'oc1', route: 'americas' },
  tr: { platform: 'tr1', route: 'europe' },
  ru: { platform: 'ru', route: 'europe' },
  ph: { platform: 'ph2', route: 'asia' },
  sg: { platform: 'sg2', route: 'asia' },
  th: { platform: 'th2', route: 'asia' },
  tw: { platform: 'tw2', route: 'asia' },
  vn: { platform: 'vn2', route: 'asia' }
};

function getRegionSettings(regionKey) {
  const cleanKey = regionKey.toLowerCase();
  return regionConfig[cleanKey] || regionConfig['euw']; // fallback to euw
}

// Middleware to check API Key
app.use((req, res, next) => {
  if (!RIOT_API_KEY || RIOT_API_KEY.includes('YOUR_RIOT_API_KEY')) {
    return res.status(500).json({
      error: 'Riot API Key is not configured. Please add it to backend/.env file'
    });
  }
  next();
});

// Helper for Riot headers
const getRiotHeaders = () => ({
  headers: {
    'X-Riot-Token': RIOT_API_KEY
  }
});

const BOT_UA_REGEX = /googlebot|bingbot|yandexbot|duckduckbot|slurp|baiduspider|facebookexternalhit|twitterbot|discordbot|applebot|semrushbot|ahrefsbot|linkedinbot|whatsapp|skypeuripreview/i;
function isBotRequest(req) {
  return BOT_UA_REGEX.test(req.headers['user-agent'] || '');
}

async function getLocalSummonerFallback(region, gameName, tagLine) {
  const normRegion = region.trim().toLowerCase();
  const normName = gameName.trim().toLowerCase();
  const normTag = tagLine.trim().toLowerCase();
  const cacheKey = `${normRegion}:${normName}:${normTag}`;

  // 1. Any cached summoner row (ignore TTL)
  const cachedRow = await db.get('SELECT summoner_data FROM summoners WHERE riot_id = ?', [cacheKey]);
  if (cachedRow && cachedRow.summoner_data) {
    return JSON.parse(cachedRow.summoner_data);
  }

  // 2. Check summoner_directory + player_ranks
  const dirRow = await db.get(
    'SELECT game_name, tag_line, puuid, region, last_champ, last_kda, last_win, last_level FROM summoner_directory WHERE riot_id = ? OR (region = ? AND LOWER(game_name) = ? AND LOWER(tag_line) = ?)',
    [cacheKey, normRegion, normName, normTag]
  );
  if (dirRow && dirRow.puuid) {
    let soloRank = null;
    try {
      const rankRow = await db.get('SELECT solo_tier, solo_rank FROM player_ranks WHERE puuid = ?', [dirRow.puuid]);
      if (rankRow && rankRow.solo_tier && rankRow.solo_tier !== 'UNRANKED') {
        soloRank = { tier: rankRow.solo_tier, rank: rankRow.solo_rank, leaguePoints: 0, wins: 0, losses: 0, winRate: 50 };
      }
    } catch (e) {}

    return {
      puuid: dirRow.puuid,
      gameName: dirRow.game_name || gameName,
      tagLine: dirRow.tag_line || tagLine,
      profileIconId: 29,
      summonerLevel: dirRow.last_level || 30,
      ranks: { solo: soloRank, flex: null },
      masteries: [],
      lastMatchSummary: dirRow.last_champ ? {
        championName: dirRow.last_champ,
        kda: dirRow.last_kda || '0/0/0',
        win: dirRow.last_win === 1
      } : null
    };
  }
  return null;
}

// 1. Search Summoner (Account-v1 + Summoner-v4 + League-v4) - with 5 min Cache
app.get('/api/summoner/:region/:gameName/:tagLine', async (req, res) => {
  const { region, gameName, tagLine } = req.params;
  const { platform, route } = getRegionSettings(region);
  const forceRefresh = req.query.refresh === 'true';

  const normalizedGameName = gameName.trim().toLowerCase();
  const normalizedTagLine = tagLine.trim().toLowerCase();
  const normalizedRegion = region.trim().toLowerCase();
  const cacheKey = `${normalizedRegion}:${normalizedGameName}:${normalizedTagLine}`;

  const isBot = isBotRequest(req);
  try {
    // ponytail: Bots always read from local SQLite first (ignoring TTL) so mass crawling never burns Riot API quota or triggers 429 Soft 404s
    if (isBot) {
      const localProfile = await getLocalSummonerFallback(region, gameName, tagLine);
      if (localProfile) {
        return res.json(localProfile);
      }
    }

    // Check SQLite cache (30 min default TTL like OP.GG; user can click Update for ?refresh=true)
    if (!forceRefresh) {
      const cachedRow = await db.get('SELECT summoner_data, cached_at FROM summoners WHERE riot_id = ?', [cacheKey]);
      const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
      if (cachedRow && (Date.now() - cachedRow.cached_at < CACHE_TTL)) {
        console.log(`[Cache Hit] Summoner data for ${cacheKey}`);
        return res.json(JSON.parse(cachedRow.summoner_data));
      }
    } else {
      console.log(`[Cache Bypass] Forcing refresh for ${cacheKey}`);
    }

    console.log(`[Cache Miss] Fetching summoner data from Riot for ${cacheKey}`);

    let puuid = null;
    let officialName = gameName;
    let officialTag = tagLine;

    // Try to resolve PUUID from the SoloQ Challenge database first to save API calls
    try {
      const challengePlayer = await new Promise((resolve, reject) => {
        challengeDb.get(
          'SELECT puuid, gameName, tagLine FROM Player WHERE LOWER(gameName) = ? AND LOWER(tagLine) = ?',
          [normalizedGameName, normalizedTagLine],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      
      if (challengePlayer && challengePlayer.puuid) {
        console.log(`[Challenge DB Hit] Resolved PUUID for ${gameName}#${tagLine} from SoloQ Challenge DB`);
        puuid = challengePlayer.puuid;
        officialName = challengePlayer.gameName;
        officialTag = challengePlayer.tagLine;
      }
    } catch (dbErr) {
      console.error('Failed to query challenge Player table:', dbErr.message);
    }

    if (!puuid) {
      // Step A: Get PUUID from Riot Account-v1
      const accountUrl = `https://${route}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
      console.log(`Calling Riot Account API: ${accountUrl}`);
      const accountResponse = await axios.get(accountUrl, getRiotHeaders());
      puuid = accountResponse.data.puuid;
      officialName = accountResponse.data.gameName;
      officialTag = accountResponse.data.tagLine;
    }

    // Step B: Get Summoner-v4 data using PUUID
    const summonerUrl = `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
    console.log(`Calling Riot Summoner API: ${summonerUrl}`);
    const summonerResponse = await axios.get(summonerUrl, getRiotHeaders());
    const { id: summonerId, profileIconId, summonerLevel } = summonerResponse.data;

    let soloRank = null;
    let flexRank = null;
    let ranked5sRank = null;

    // Step C: Get League-v4 rank info using the PUUID directly (modern endpoint)
    const leagueUrl = `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
    console.log(`Calling Riot League API (by-puuid): ${leagueUrl}`);
    try {
      const leagueResponse = await axios.get(leagueUrl, getRiotHeaders());
      
      // Parse queue types (Solo/Duo vs Flex vs Ranked 5s)
      leagueResponse.data.forEach(entry => {
        const rankInfo = {
          tier: entry.tier,
          rank: entry.rank,
          leaguePoints: entry.leaguePoints,
          wins: entry.wins,
          losses: entry.losses,
          winRate: Math.round((entry.wins / (entry.wins + entry.losses)) * 100)
        };

        if (entry.queueType === 'RANKED_SOLO_5x5') {
          soloRank = rankInfo;
        } else if (entry.queueType === 'RANKED_FLEX_SR') {
          flexRank = rankInfo;
        } else if (entry.queueType === 'RANKED_PREMADE_5x5' || entry.queueType === 'RANKED_TEAM_5x5') {
          ranked5sRank = rankInfo;
        }
      });
    } catch (leagueErr) {
      console.error('Failed to fetch league ranks by puuid:', leagueErr.message);
    }

    // Step D: Get top 3 champion masteries
    let masteries = [];
    const masteryUrl = `https://${platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=3`;
    console.log(`Calling Riot Mastery API: ${masteryUrl}`);
    try {
      const masteryResponse = await axios.get(masteryUrl, getRiotHeaders());
      masteries = masteryResponse.data.map(m => ({
        championId: m.championId,
        championLevel: m.championLevel,
        championPoints: m.championPoints
      }));
    } catch (masteryErr) {
      console.error('Failed to fetch champion masteries:', masteryErr.message);
    }

    const summonerData = {
      puuid,
      gameName: officialName,
      tagLine: officialTag,
      profileIconId,
      summonerLevel,
      ranks: {
        solo: soloRank,
        flex: flexRank,
        ranked5s: ranked5sRank
      },
      masteries
    };

    // Save to SQLite Cache
    try {
      await db.run(
        'INSERT OR REPLACE INTO summoners (riot_id, puuid, summoner_data, cached_at) VALUES (?, ?, ?, ?)',
        [cacheKey, puuid, JSON.stringify(summonerData), Date.now()]
      );
      console.log(`[Cache Save] Summoner data saved for ${cacheKey}`);

      // Also save to summoner directory for autocomplete
      await db.run(
        'INSERT OR REPLACE INTO summoner_directory (riot_id, game_name, tag_line, puuid, region) VALUES (?, ?, ?, ?, ?)',
        [cacheKey, officialName, officialTag, puuid, normalizedRegion]
      );
      console.log(`[Directory Save] Summoner saved to directory: ${officialName}#${officialTag}`);
    } catch (dbErr) {
      console.error('Failed to cache summoner data in SQLite:', dbErr.message);
    }

    res.json(summonerData);

  } catch (error) {
    console.error('Error fetching summoner details:');
    if (error.response) {
      console.error(`URL: ${error.config?.url}`);
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    } else {
      console.error(`Message: ${error.message}`);
    }
    const status = error.response ? error.response.status : 500;
    if (status === 404) {
      // Remove renamed/deleted account from directory so it stops appearing in Sitemap
      db.run('DELETE FROM summoner_directory WHERE riot_id = ?', [cacheKey]).catch(() => {});
    } else {
      // On 429 Rate Limit or 5xx, serve stale local data if we have any instead of failing with Soft 404
      const fallback = await getLocalSummonerFallback(region, gameName, tagLine).catch(() => null);
      if (fallback) {
        return res.json(fallback);
      }
    }
    const message = error.response ? error.response.data.status?.message || 'Error communicating with Riot API' : error.message;
    res.status(status).json({ error: message });
  }
});

// Helper to index match participants into summoner_directory for autocompletion and zero-API SEO
async function indexParticipants(participants, region) {
  if (!participants || !Array.isArray(participants)) return;
  const cleanRegion = region.toLowerCase();
  
  const promises = participants.map(p => {
    if (!p.gameName || !p.tagLine) return Promise.resolve();
    const cacheKey = `${cleanRegion}:${p.gameName.toLowerCase()}:${p.tagLine.toLowerCase()}`;
    const kdaStr = `${p.kills || 0}/${p.deaths || 0}/${p.assists || 0} (${p.kda || '0.0'} KDA)`;
    const winInt = p.win ? 1 : 0;
    const champLvl = p.champLevel || 18;
    return db.run(
      'INSERT OR REPLACE INTO summoner_directory (riot_id, game_name, tag_line, puuid, region, last_champ, last_kda, last_win, last_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [cacheKey, p.gameName, p.tagLine, p.puuid, cleanRegion, p.championName || '', kdaStr, winInt, champLvl]
    ).catch(err => {
      console.error(`Failed to index participant ${p.gameName} in directory:`, err.message);
    });
  });

  await Promise.all(promises);
}

// Mapping of ranks/tiers to numeric values to allow averaging
const TIER_VALUES = {
  'IRON': 1,
  'BRONZE': 2,
  'SILVER': 3,
  'GOLD': 4,
  'PLATINUM': 5,
  'EMERALD': 6,
  'DIAMOND': 7,
  'MASTER': 8,
  'GRANDMASTER': 9,
  'CHALLENGER': 10
};

const DIVISION_VALUES = {
  'IV': 0.0,
  'III': 0.25,
  'II': 0.5,
  'I': 0.75
};

// Function to resolve ranks for a list of puuids
async function resolvePlayerRanks(puuids, platform) {
  if (!puuids || puuids.length === 0) return {};
  const ranksMap = {};
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  // 1. Fetch whatever we can from SQLite player_ranks cache
  const placeholders = puuids.map(() => '?').join(',');
  let cachedRows = [];
  try {
    cachedRows = await db.all(
      `SELECT puuid, solo_tier, solo_rank, cached_at FROM player_ranks WHERE puuid IN (${placeholders})`,
      puuids
    );
  } catch (err) {
    console.error('Failed to query player_ranks table:', err.message);
  }

  const cachedMap = {};
  cachedRows.forEach(row => {
    // Only use if not older than 24 hours
    if (now - row.cached_at < ONE_DAY) {
      cachedMap[row.puuid] = { tier: row.solo_tier, rank: row.solo_rank };
    }
  });

  // 2. Identify missing PUUIDs that need to be fetched from Riot
  const missingPuuids = puuids.filter(puuid => !cachedMap[puuid]);

  if (missingPuuids.length > 0) {
    // ponytail: limitamos a un máximo de 3 consultas reales a Riot para proteger la cuota de la API Key. El resto se devuelven como UNRANKED.
    const limitedPuuids = missingPuuids.slice(0, 3);
    console.log(`[Elo Resolver] Querying Riot API for ${limitedPuuids.length} of ${missingPuuids.length} missing player ranks...`);
    
    // Procesar de forma secuencial controlada con delay de 50ms
    for (const puuid of limitedPuuids) {
      try {
        const leagueUrl = `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const res = await axios.get(leagueUrl, getRiotHeaders());
        let soloEntry = res.data.find(entry => entry.queueType === 'RANKED_SOLO_5x5');
        const tier = soloEntry ? soloEntry.tier : 'UNRANKED';
        const division = soloEntry ? soloEntry.rank : '';

        // Write to database cache
        await db.run(
          'INSERT OR REPLACE INTO player_ranks (puuid, solo_tier, solo_rank, cached_at) VALUES (?, ?, ?, ?)',
          [puuid, tier, division, now]
        );

        cachedMap[puuid] = { tier, rank: division };
      } catch (err) {
        console.error(`[Elo Resolver] Failed to fetch rank for ${puuid}:`, err.message);
        cachedMap[puuid] = { tier: 'UNRANKED', rank: '' };
      }
    }

    // El resto de los que no pudimos consultar los marcamos como UNRANKED temporalmente
    missingPuuids.forEach(puuid => {
      if (!cachedMap[puuid]) {
        cachedMap[puuid] = { tier: 'UNRANKED', rank: '' };
      }
    });
  }

  return cachedMap;
}

function calculateAverageElo(participantsRanks) {
  let totalValue = 0;
  let count = 0;

  participantsRanks.forEach(rankInfo => {
    if (!rankInfo || rankInfo.tier === 'UNRANKED') return;

    const tierVal = TIER_VALUES[rankInfo.tier.toUpperCase()];
    if (tierVal) {
      const divVal = DIVISION_VALUES[rankInfo.rank] || 0;
      totalValue += (tierVal + divVal);
      count++;
    }
  });

  if (count === 0) return 'Unranked';

  const avgValue = totalValue / count;
  const integerPart = Math.floor(avgValue);
  const decimalPart = avgValue - integerPart;

  let closestTier = 'UNRANKED';
  Object.keys(TIER_VALUES).forEach(tierKey => {
    if (TIER_VALUES[tierKey] === integerPart) {
      closestTier = tierKey;
    }
  });

  if (closestTier === 'UNRANKED' || integerPart >= 8) {
    if (integerPart === 8) return 'Maestro';
    if (integerPart === 9) return 'Gran Maestro';
    if (integerPart >= 10) return 'Retador';
    return closestTier;
  }

  let closestDiv = 'IV';
  let minDiff = 999;
  Object.keys(DIVISION_VALUES).forEach(divKey => {
    const diff = Math.abs(DIVISION_VALUES[divKey] - decimalPart);
    if (diff < minDiff) {
      minDiff = diff;
      closestDiv = divKey;
    }
  });

  const tierTranslations = {
    'IRON': 'Hierro',
    'BRONZE': 'Bronce',
    'SILVER': 'Plata',
    'GOLD': 'Oro',
    'PLATINUM': 'Platino',
    'EMERALD': 'Esmeralda',
    'DIAMOND': 'Diamante'
  };

  const translatedTier = tierTranslations[closestTier] || closestTier;
  return `${translatedTier} ${closestDiv}`;
}

// 2. Fetch Match History IDs and detailed Match Details - with Permanent Cache
app.get('/api/matches/:region/:puuid', async (req, res) => {
  const { region, puuid } = req.params;
  const { route } = getRegionSettings(region);
  const ua = req.headers['user-agent'] || '';
  const isBot = /googlebot|bingbot|yandexbot|duckduckbot|slurp|baiduspider|facebookexternalhit|twitterbot|discordbot|applebot|semrushbot|ahrefsbot/i.test(ua);
  const start = parseInt(req.query.start || 0, 10); // Support pagination start index
  const rawCount = parseInt(req.query.count || 8, 10); // Default to 8 matches for speed
  // ponytail: bots only get up to 8 matches and never trigger deep 150-match Riot fetches that fill the 8.7GB VPS disk
  const count = isBot ? Math.min(rawCount, 8) : rawCount;
  const queue = req.query.queue; // 'ranked_solo', 'ranked_flex', 'aram', 'normal', 'all'
  const forceRefresh = isBot ? false : (req.query.refresh === 'true');

  try {
    // ponytail: Bots never call Riot Match-V5 API; return empty or already cached matches immediately to prevent 429s and timeouts
    if (isBot) {
      return res.json([]);
    }
          // Step A: Get match IDs from Riot API
      let matchIds = [];

      if (queue === 'aram') {
        const url450 = `https://${route}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=100&queue=450`;
        const url480 = `https://${route}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=100&queue=480`;
        
        const [res450, res480] = await Promise.all([
          axios.get(url450, getRiotHeaders()).catch(() => ({ data: [] })),
          axios.get(url480, getRiotHeaders()).catch(() => ({ data: [] }))
        ]);
        
        let combined = [...res450.data, ...res480.data];
        combined.sort((a, b) => {
          const numA = parseInt(a.split('_')[1] || '0', 10);
          const numB = parseInt(b.split('_')[1] || '0', 10);
          return numB - numA;
        });
        
        matchIds = combined.slice(start, start + count);
      } else {
        let currentStart = start;
        let remaining = count;

        while (remaining > 0) {
          const fetchCount = Math.min(remaining, 100);
          let matchIdsUrl = `https://${route}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=${currentStart}&count=${fetchCount}`;
          
          if (queue === 'ranked_solo') {
            matchIdsUrl += '&queue=420';
          } else if (queue === 'ranked_flex') {
            matchIdsUrl += '&queue=440';
          } else if (queue === 'ranked_5s') {
            matchIdsUrl += '&queue=710';
          } else if (queue === 'normal') {
            matchIdsUrl += '&type=normal';
          }

          console.log(`Calling Riot Matches API: ${matchIdsUrl}`);
          const matchIdsResponse = await axios.get(matchIdsUrl, getRiotHeaders());
          const chunk = matchIdsResponse.data;
          
          if (!chunk || chunk.length === 0) break;

          matchIds = matchIds.concat(chunk);
          if (chunk.length < fetchCount) break;
          
          currentStart += chunk.length;
          remaining -= chunk.length;
        }
      }

      if (matchIds.length === 0) {
      return res.json([]);
    }

    // Step B: Find which match IDs are already cached in SQLite matches table (skip if forceRefresh)
    const cachedMatchesMap = {};
    if (!forceRefresh) {
      const placeholders = matchIds.map(() => '?').join(',');
      const cachedRows = await db.all(
        `SELECT match_id, match_data FROM matches WHERE match_id IN (${placeholders})`,
        matchIds
      );
      // Create a map of cached matches for fast lookup
      cachedRows.forEach(row => {
        cachedMatchesMap[row.match_id] = JSON.parse(row.match_data);
      });
    }

    // Step C: Fetch details for each match ID (either from SQLite or Riot API)
    const neutralMatches = [];
    const allMissMatchIds = matchIds.filter(id => !cachedMatchesMap[id]);
    // ponytail: bots download at most 2 uncached matches to avoid 3-minute Riot API loops and Nginx 499 timeouts
    const missMatchIds = isBot ? allMissMatchIds.slice(0, 2) : allMissMatchIds;

    // Primero agregamos todas las partidas que ya están en caché (para una respuesta rápida)
    matchIds.forEach(matchId => {
      if (cachedMatchesMap[matchId]) {
        console.log(`[Cache Hit] Match data for ${matchId}`);
        neutralMatches.push(cachedMatchesMap[matchId]);
      }
    });

    // Luego descargamos secuencialmente las partidas no cacheadas
    // ponytail: secuencial con delay de 1200ms para no superar el límite de 100 req/2min de la API key de desarrollo
    let rateLimited = false;
    for (const matchId of missMatchIds) {
      if (rateLimited) {
        console.log(`[Skipping Match] ${matchId} due to active 429 rate limit`);
        continue;
      }

      try {
        const matchUrl = `https://${route}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
        console.log(`[Cache Miss] Fetching match details from Riot: ${matchUrl}`);
        
        // Delay de 1200ms para mantenerse bajo el límite de 100 peticiones/2min
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        const detailRes = await axios.get(matchUrl, getRiotHeaders());
        const info = detailRes.data.info;

        // Simplify participants list for scoreboard overview
        const teamParticipants = info.participants.map(p => ({
          puuid: p.puuid,
          gameName: p.riotIdGameName || p.summonerName,
          tagLine: p.riotIdTagline || '',
          championName: p.championName,
          champLevel: p.champLevel,
          teamId: p.teamId,
          win: p.win,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          kda: p.deaths === 0 ? (p.kills + p.assists).toFixed(1) : ((p.kills + p.assists) / p.deaths).toFixed(1),
          damageDealt: p.totalDamageDealtToChampions,
          goldEarned: p.goldEarned,
          cs: p.totalMinionsKilled + p.neutralMinionsKilled,
          csPerMin: ((p.totalMinionsKilled + p.neutralMinionsKilled) / (info.gameDuration / 60)).toFixed(1),
          visionScore: p.visionScore,
          items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
          summonerSpells: [p.summoner1Id, p.summoner2Id],
          perks: {
            primary: p.perks?.styles[0]?.selections[0]?.perk,
            style: p.perks?.styles[0]?.style
          },
          role: p.individualPosition || p.teamPosition || 'UTILITY',
          damageTaken: p.totalDamageTaken || 0,
          pentakills: p.pentakills || 0,
          timeCCingOthers: p.timeCCingOthers || 0,
          totalHeal: p.totalHeal || 0,
          challenges: p.challenges || {}
        }));

        const neutralMatchData = {
          matchId,
          gameMode: info.gameMode,
          gameDuration: info.gameDuration,
          gameCreation: info.gameCreation,
          queueId: info.queueId,
          participants: teamParticipants,
          teams: info.teams
        };

        // Save new match details permanently to database
        try {
          await db.run(
            'INSERT OR REPLACE INTO matches (match_id, match_data) VALUES (?, ?)',
            [matchId, JSON.stringify(neutralMatchData)]
          );
          console.log(`[Cache Save] Match details saved for ${matchId}`);
        } catch (dbErr) {
          console.error(`Failed to cache match ${matchId}:`, dbErr.message);
        }

        neutralMatches.push(neutralMatchData);

      } catch (err) {
        console.error(`Error fetching match ${matchId} from Riot:`, err.message);
        if (err.response && err.response.status === 429) {
          console.warn(`[Rate Limit Alert] Riot API returned a 429 status. Breaking sequence loop.`);
          rateLimited = true;
        }
      }
    }

    // Fetch ranks for all participants across matches to calculate average Elo
    let ranksMap = {};
    if (neutralMatches.length > 0) {
      const { platform } = getRegionSettings(region);
      const allMatchPuuids = [...new Set(neutralMatches.flatMap(m => m.participants.map(p => p.puuid)))];
      try {
        ranksMap = await resolvePlayerRanks(allMatchPuuids, platform);
      } catch (err) {
        console.error('Failed to resolve player ranks for average Elo:', err.message);
      }
    }

    // Step D: Map matches to include playerStats specific to the queried puuid
    const matchesWithPlayerStats = neutralMatches.map(m => {
      const player = m.participants.find(p => p.puuid === puuid);
      if (!player) return null;

      const teamKills = m.participants
        .filter(p => p.teamId === player.teamId)
        .reduce((acc, curr) => acc + curr.kills, 0);

      const killParticipation = teamKills > 0
        ? Math.round(((player.kills + player.assists) / teamKills) * 100)
        : 0;

      // Calculate average Elo
      const matchRanks = m.participants.map(p => ranksMap[p.puuid]).filter(Boolean);
      const averageElo = calculateAverageElo(matchRanks);

      const participantsWithRanks = m.participants.map(p => ({
        ...p,
        rank: ranksMap[p.puuid] || { tier: 'UNRANKED', rank: '' }
      }));

      return {
        matchId: m.matchId,
        gameMode: m.gameMode,
        gameDuration: m.gameDuration,
        gameCreation: m.gameCreation,
        queueId: m.queueId,
        averageElo,
        playerStats: {
          win: player.win,
          championName: player.championName,
          champLevel: player.champLevel,
          kills: player.kills,
          deaths: player.deaths,
          assists: player.assists,
          kda: player.kda,
          cs: player.cs,
          csPerMin: player.csPerMin,
          goldEarned: player.goldEarned,
          killParticipation,
          items: player.items,
          summonerSpells: player.summonerSpells,
          perks: player.perks,
          role: player.role || '',
          damageDealt: player.damageDealt || 0,
          damageTaken: player.damageTaken || 0,
          pentakills: player.pentakills || 0,
          timeCCingOthers: player.timeCCingOthers || 0,
          totalHeal: player.totalHeal || 0,
          challenges: player.challenges || {}
        },
        participants: participantsWithRanks
      };
    }).filter(m => m !== null);

    res.json(matchesWithPlayerStats);

    // Auto-prune old cache entries occasionally to prevent SQLite from filling the 8.7GB disk
    if (missMatchIds.length > 0 && Math.random() < 0.1) {
      db.run('DELETE FROM matches WHERE rowid NOT IN (SELECT rowid FROM matches ORDER BY rowid DESC LIMIT 25000)').catch(() => {});
      db.run('DELETE FROM summoner_directory WHERE rowid NOT IN (SELECT rowid FROM summoner_directory ORDER BY rowid DESC LIMIT 500000)').catch(() => {});
    }

    // Index participants in background directory for autocompletion (do not await, skip for bots)
    if (neutralMatches.length > 0 && !isBot) {
      const allParticipants = neutralMatches.flatMap(m => m.participants);
      indexParticipants(allParticipants, region).then(() => {
        console.log(`[Directory Index] Successfully indexed ${allParticipants.length} participants in the background.`);
      }).catch(err => {
        console.error('Background participant indexing failed:', err.message);
      });
    }

  } catch (error) {
    console.error('Error fetching matches:', error.message);
    const status = error.response ? error.response.status : 500;
    res.status(status).json({ error: 'Failed to retrieve match history' });
  }
});

// 3. Search summoners in directory (autocomplete)
app.get('/api/summoner-directory/search', async (req, res) => {
  const { region, q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.json([]);
  }

  const cleanRegion = region ? region.toLowerCase() : 'euw';
  const queryPattern = `${q.trim()}%`; // starts with

  try {
    const rows = await db.all(
      'SELECT game_name, tag_line, region FROM summoner_directory WHERE region = ? AND game_name LIKE ? LIMIT 5',
      [cleanRegion, queryPattern]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error searching summoner directory:', error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// 4. Generate dynamic scalable sitemap for SEO (supports ?page=N for >40,000 URLs)
app.get('/api/sitemap.xml', async (req, res) => {
  const PAGE_SIZE = 40000;
  const pageParam = parseInt(req.query.page || '0', 10);

  try {
    const countRow = await db.get('SELECT COUNT(1) as total FROM summoner_directory');
    const total = countRow ? countRow.total : 0;

    // If we have more than PAGE_SIZE entries and no ?page= param was passed, serve a Sitemap Index
    if (total > PAGE_SIZE && !pageParam) {
      const totalPages = Math.ceil(total / PAGE_SIZE);
      let indexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
      for (let p = 1; p <= totalPages; p++) {
        indexXml += `  <sitemap>\n    <loc>https://tracker.chupachotas.es/api/sitemap.xml?page=${p}</loc>\n  </sitemap>\n`;
      }
      indexXml += `</sitemapindex>`;
      res.header('Content-Type', 'application/xml');
      return res.send(indexXml);
    }

    const currentPage = pageParam > 0 ? pageParam : 1;
    const offset = (currentPage - 1) * PAGE_SIZE;
    const rows = await db.all(
      'SELECT game_name, tag_line, region FROM summoner_directory ORDER BY rowid DESC LIMIT ? OFFSET ?',
      [PAGE_SIZE, offset]
    );
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    if (currentPage === 1) {
      xml += `  <url>\n    <loc>https://tracker.chupachotas.es/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
    }
    
    rows.forEach(row => {
      if (!row.game_name || !row.tag_line) return;
      const encodedName = encodeURIComponent(row.game_name);
      const encodedTag = encodeURIComponent(row.tag_line);
      xml += `  <url>\n    <loc>https://tracker.chupachotas.es/${row.region}/${encodedName}-${encodedTag}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });
    
    xml += `</urlset>`;
    
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generating sitemap:', error.message);
    res.status(500).send('Error generating sitemap');
  }
});

// soloq_challenge integration helper and endpoint
const TIER_BASE_LP = {
  'IRON': 0,
  'BRONZE': 400,
  'SILVER': 800,
  'GOLD': 1200,
  'PLATINUM': 1600,
  'EMERALD': 2000,
  'DIAMOND': 2400,
  'MASTER': 2800,
  'GRANDMASTER': 2800,
  'CHALLENGER': 2800
};

const DIVISION_LP = {
  'IV': 0,
  'III': 100,
  'II': 200,
  'I': 300
};

function getPlayerGlobalLp(tier, rank, lp) {
  const normTier = (tier || 'UNRANKED').toUpperCase();
  const normRank = (rank || '').toUpperCase();
  const base = TIER_BASE_LP[normTier] || 0;
  
  if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(normTier)) {
    return base + (lp || 0);
  }
  
  const divLp = DIVISION_LP[normRank] || 0;
  return base + divLp + (lp || 0);
}

function getChallengePlayers() {
  return new Promise((resolve, reject) => {
    challengeDb.all(
      'SELECT id, gameName, tagLine, alias, puuid, profileIconId, tier, rank, leaguePoints, wins, losses FROM Player',
      [],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

app.get('/api/challenge/players', async (req, res) => {
  try {
    const players = await getChallengePlayers();
    
    // Calculate global LP and sort descendently
    const sortedPlayers = players.map(p => {
      const globalLp = getPlayerGlobalLp(p.tier, p.rank, p.leaguePoints);
      return { ...p, globalLp };
    }).sort((a, b) => b.globalLp - a.globalLp);
    
    res.json(sortedPlayers);
  } catch (error) {
    console.error('Failed to fetch challenge players:', error.message);
    res.status(500).json({ error: 'Failed to fetch challenge players from soloq_challenge database' });
  }
});


app.get('/api/bot-seo/:region/:gameName/:tagLine', async (req, res) => {
  const { region, gameName, tagLine } = req.params;
  const cleanRegion = (region || 'euw').toLowerCase();
  const fs = require('fs');

  try {
    // 1. Try local SQLite first (summoners table or summoner_directory + player_ranks) — 0 Riot API calls!
    let summoner = await getLocalSummonerFallback(cleanRegion, gameName, tagLine);

    // 2. Only if completely unknown locally, query /api/summoner
    if (!summoner) {
      const summonerRes = await axios.get(`http://localhost:${PORT}/api/summoner/${cleanRegion}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
      summoner = summonerRes.data;
    }

    const officialName = summoner.gameName || gameName;
    const officialTag = summoner.tagLine || tagLine;
    const level = summoner.summonerLevel || 30;
    const solo = summoner.ranks?.solo;
    const flex = summoner.ranks?.flex;
    const rankText = solo
      ? `${solo.tier} ${solo.rank} (${solo.leaguePoints || 0} LP, ${solo.wins || 0}W/${solo.losses || 0}L - ${solo.winRate || 50}% WR)`
      : 'Unranked / Clasificatorias en curso';
    const flexText = flex
      ? `${flex.tier} ${flex.rank} (${flex.leaguePoints || 0} LP)`
      : 'Unranked';

    const title = `${officialName}#${officialTag} (${cleanRegion.toUpperCase()}) - LoL Stats, MMR & Historial - Chupachotas Tracker`;
    const desc = `Consulta las estadísticas de ${officialName}#${officialTag} en League of Legends (${cleanRegion.toUpperCase()}, Nivel ${level}, Rango SoloQ: ${rankText}). Match history, KDA, winrate, campeones y MMR en tiempo real.`;
    const avatarUrl = `https://ddragon.leagueoflegends.com/cdn/14.20.1/img/profileicon/${summoner.profileIconId || 29}.png`;
    const canonical = `https://tracker.chupachotas.es/${cleanRegion}/${encodeURIComponent(officialName)}-${encodeURIComponent(officialTag)}`;

    let html = fs.readFileSync('/var/www/tracker/index.html', 'utf8');

    html = html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${desc}">`);
    html = html.replace(/<meta property="og:title" content="[^"]*">/i, `<meta property="og:title" content="${title}">`);
    html = html.replace(/<meta property="og:description" content="[^"]*">/i, `<meta property="og:description" content="${desc}">`);

    const injectedTags = `
    <meta property="og:image" content="${avatarUrl}">
    <meta name="twitter:image" content="${avatarUrl}">
    <link rel="canonical" href="${canonical}" />
  </head>`;
    html = html.replace('</head>', injectedTags);

    const lastMatchHtml = summoner.lastMatchSummary
      ? `<li><strong>Última partida registrada:</strong> ${summoner.lastMatchSummary.championName} (${summoner.lastMatchSummary.kda} - ${summoner.lastMatchSummary.win ? 'Victoria' : 'Derrota'})</li>`
      : '';

    // Inject semantic SSR profile summary inside <div id="root"> so Googlebot sees rich, unique content immediately (fixes "Crawled - currently not indexed")
    const ssrBody = `<div id="root">
      <main style="max-width:960px;margin:2rem auto;padding:1.5rem;color:#e2e8f0;font-family:sans-serif;">
        <h1>${officialName}#${officialTag} - Estadísticas de League of Legends (${cleanRegion.toUpperCase()})</h1>
        <p>${desc}</p>
        <section>
          <h2>Resumen de Perfil y Rango (LoL Stats &amp; MMR)</h2>
          <ul>
            <li><strong>Invocador (Riot ID):</strong> ${officialName}#${officialTag}</li>
            <li><strong>Región:</strong> ${cleanRegion.toUpperCase()}</li>
            <li><strong>Nivel de Invocador:</strong> ${level}</li>
            <li><strong>Clasificatoria Solo/Dúo (Ranked SoloQ):</strong> ${rankText}</li>
            <li><strong>Clasificatoria Flexible (Ranked Flex):</strong> ${flexText}</li>
            ${lastMatchHtml}
          </ul>
        </section>
        <section>
          <h2>Historial de Partidas, Campeones, KDA y Rendimiento</h2>
          <p>Análisis completo de partidas recientes, KDA promedio, CS por minuto, puntuación de visión, preferencia de roles y rendimiento con campeones de ${officialName}#${officialTag} en el servidor ${cleanRegion.toUpperCase()} de League of Legends.</p>
        </section>
      </main>
    </div>`;
    html = html.replace('<div id="root"></div>', ssrBody);

    res.send(html);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    try {
      let html = fs.readFileSync('/var/www/tracker/index.html', 'utf8');
      // If Riot API is rate-limited (429) or temporary error (5xx), return 503 with Retry-After so Googlebot retries later instead of marking Soft 404 / 404
      if (status === 429 || status >= 500) {
        res.set('Retry-After', '120');
        return res.status(503).send(html);
      }
      const notFoundTitle = 'Invocador no encontrado - Chupachotas Tracker';
      html = html.replace(/<title>.*?<\/title>/i, '<title>' + notFoundTitle + '</title>');
      const noindexTags = '\n    <meta name="robots" content="noindex, nofollow" />\n  </head>';
      html = html.replace('</head>', noindexTags);
      res.status(404).send(html);
    } catch (e) {
      res.status(status === 404 ? 404 : 503).send('Unavailable');
    }
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
