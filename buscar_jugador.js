const fs = require('fs');
const path = require('path');
const https = require('https');

const LOL_PATH = "C:\\Riot Games\\League of Legends";

function getLCUCredentials() {
    const lockfilePath = path.join(LOL_PATH, "lockfile");
    if (!fs.existsSync(lockfilePath)) {
        throw new Error("No se encontró el archivo 'lockfile'. Asegúrate de que el cliente de LoL esté abierto.");
    }
    const content = fs.readFileSync(lockfilePath, 'utf-8');
    const [name, pid, port, password, protocol] = content.split(':');
    return { port, password };
}

async function requestLCU(port, password, endpoint) {
    return new Promise((resolve, reject) => {
        const auth = Buffer.from(`riot:${password}`).toString('base64');
        const options = {
            hostname: '127.0.0.1',
            port: port,
            path: endpoint,
            method: 'GET',
            rejectUnauthorized: false,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error("Error al parsear JSON"));
                    }
                } else {
                    reject(new Error(`Petición falló con código ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
}

// Mapeo básico de IDs de campeones conocidos para LoL Classic (S3)
const championMapping = {
    1: "Annie", 2: "Olaf", 3: "Galio", 4: "Twisted Fate", 5: "Xin Zhao", 6: "Urgot",
    7: "LeBlanc", 8: "Vladimir", 9: "Fiddlesticks", 10: "Kayle", 11: "Master Yi",
    12: "Alistar", 13: "Ryze", 14: "Sion", 15: "Sivir", 16: "Soraka", 17: "Teemo",
    18: "Tristana", 19: "Warwick", 20: "Nunu", 21: "Miss Fortune", 22: "Ashe",
    23: "Tryndamere", 24: "Jax", 25: "Morgana", 26: "Zilean", 27: "Singed",
    28: "Evelynn", 29: "Twitch", 30: "Karthus", 31: "Cho'Gath", 32: "Amumu",
    33: "Rammus", 34: "Anivia", 35: "Shaco", 36: "Dr. Mundo", 37: "Sona",
    38: "Kassadin", 39: "Irelia", 40: "Janna", 41: "Gangplank", 42: "Corki",
    43: "Karma", 44: "Taric", 45: "Veigar", 48: "Trundle", 50: "Swain",
    51: "Caitlyn", 53: "Blitzcrank", 54: "Malphite", 55: "Katarina", 57: "Maokai",
    58: "Renekton", 59: "Jarvan IV", 60: "Elise", 61: "Orianna", 62: "Wukong",
    63: "Brand", 64: "Lee Sin", 67: "Vayne", 68: "Rumble", 69: "Cassiopeia",
    72: "Skarner", 74: "Heimerdinger", 75: "Nasus", 76: "Nidalee", 77: "Udyr",
    78: "Poppy", 79: "Gragas", 80: "Pantheon", 81: "Ezreal", 82: "Mordekaiser",
    83: "Yorick", 84: "Akali", 85: "Kennen", 86: "Garen", 89: "Leona",
    90: "Malzahar", 91: "Talon", 92: "Riven", 96: "Kog'Maw", 98: "Shen",
    99: "Lux", 101: "Xerath", 102: "Shyvana", 103: "Ahri", 104: "Graves",
    105: "Fizz", 106: "Volibear", 107: "Rengar", 110: "Varus", 111: "Nautilus",
    112: "Viktor", 113: "Sejuani", 114: "Fiora", 115: "Ziggs", 117: "Lulu",
    119: "Draven", 120: "Hecarim", 121: "Khazix", 122: "Darius", 126: "Jayce",
    127: "Lissandra", 131: "Diana", 133: "Quinn", 134: "Syndra", 143: "Zyra",
    154: "Zac", 238: "Zed", 254: "Vi", 266: "Aatrox", 412: "Thresh",
    60001: "Aatrox", 60002: "Ahri", 60003: "Akali", 60004: "Alistar", 60005: "Amumu",
    60006: "Anivia", 60007: "Annie", 60008: "Ashe", 60009: "Blitzcrank", 60010: "Brand",
    60011: "Caitlyn", 60012: "Cassiopeia", 60013: "Cho'Gath", 60014: "Corki", 60015: "Darius",
    60016: "Diana", 60017: "Dr. Mundo", 60018: "Draven", 60019: "Elise", 60020: "Evelynn",
    60021: "Ezreal", 60022: "Fiddlesticks", 60023: "Fiora", 60024: "Fizz", 60025: "Galio",
    60026: "Gangplank", 60027: "Garen", 60028: "Gragas", 60029: "Graves", 60030: "Hecarim",
    60031: "Heimerdinger", 60032: "Irelia", 60033: "Janna", 60034: "Jarvan IV", 60035: "Jax",
    60036: "Jayce", 60037: "Karma", 60038: "Karthus", 60039: "Kassadin", 60040: "Katarina",
    60041: "Kayle", 60042: "Kennen", 60043: "Kha'Zix", 60044: "Kog'Maw", 60045: "LeBlanc",
    60046: "Lee Sin", 60047: "Leona", 60048: "Lissandra", 60049: "Lulu", 60050: "Lux",
    60051: "Malphite", 60052: "Malzahar", 60053: "Maokai", 60054: "Master Yi", 60055: "Miss Fortune",
    60056: "Mordekaiser", 60057: "Morgana", 60058: "Nami", 60059: "Nasus", 60060: "Nautilus",
    60061: "Nidalee", 60062: "Nunu", 60063: "Olaf", 60064: "Orianna", 60065: "Pantheon",
    60066: "Poppy", 60067: "Quinn", 60068: "Rammus", 60069: "Renekton", 60070: "Rengar",
    60071: "Riven", 60072: "Rumble", 60073: "Ryze", 60074: "Sejuani", 60075: "Shaco",
    60076: "Shen", 60077: "Shyvana", 60078: "Singed", 60079: "Sion", 60080: "Sivir",
    60081: "Skarner", 60082: "Sona", 60083: "Soraka", 60084: "Swain", 60085: "Syndra",
    60086: "Talon", 60087: "Taric", 60088: "Teemo", 60089: "Thresh", 60090: "Tristana",
    60091: "Trundle", 60092: "Tryndamere", 60093: "Twisted Fate", 60094: "Twitch", 60095: "Udyr",
    60096: "Urgot", 60097: "Varus", 60098: "Vayne", 60099: "Veigar", 60100: "Vi",
    60101: "Viktor", 60102: "Vladimir", 60103: "Volibear", 60104: "Warwick", 60105: "Wukong",
    60106: "Xerath", 60107: "Xin Zhao", 60108: "Yorick", 60109: "Zac", 60110: "Zed",
    60111: "Ziggs", 60112: "Zilean", 60113: "Zyra"
};

async function main() {
    try {
        const { port, password } = getLCUCredentials();
        
        // 1. Obtener la cuenta del usuario actual
        const summoner = await requestLCU(port, password, '/lol-summoner/v1/current-summoner');
        const myPuuid = summoner.puuid;

        // 2. Obtener lista de partidas
        const history = await requestLCU(port, password, `/lol-match-history/v1/products/lol/${myPuuid}/matches`);
        const games = history.games?.games || [];

        // Filtrar estrictamente por queueId 4310
        const classicGames = games.filter(g => g.queueId === 4310);

        if (classicGames.length === 0) {
            console.log("No se encontraron partidas de LoL Classic.");
            return;
        }

        console.log(`[*] Escaneando ${classicGames.length} partidas de LoL Classic buscando a 'MasterOfMovement'...`);
        
        const matchesWithTarget = [];
        const usedChampions = new Set();

        for (let i = 0; i < classicGames.length; i++) {
            const gameId = classicGames[i].gameId;
            const game = await requestLCU(port, password, `/lol-match-history/v1/games/${gameId}`);

            // Buscar la identidad del jugador objetivo
            const targetIdentity = game.participantIdentities?.find(pi => 
                pi.player?.gameName?.toLowerCase() === 'masterofmovement'
            );

            if (targetIdentity) {
                const participantId = targetIdentity.participantId;
                const participant = game.participants?.find(p => p.participantId === participantId);
                
                if (participant) {
                    const champId = participant.championId;
                    const champName = championMapping[champId] || `Campeón ID ${champId}`;
                    usedChampions.add(champName);
                    
                    matchesWithTarget.push({
                        gameId,
                        champion: champName,
                        kda: `${participant.stats?.kills}/${participant.stats?.deaths}/${participant.stats?.assists}`,
                        win: participant.stats?.win ? "Victoria" : "Derrota"
                    });
                }
            }
        }

        if (matchesWithTarget.length === 0) {
            console.log("\n[-] No se encontró al jugador 'MasterOfMovement' en ninguna de tus partidas de LoL Classic recientes.");
        } else {
            console.log(`\n[+] ¡Jugador encontrado! Aparece en ${matchesWithTarget.length} partidas.`);
            console.log(`\nCampeones que ha usado 'MasterOfMovement':`);
            console.log(Array.from(usedChampions).map(c => `- ${c}`).join('\n'));

            console.log(`\nDetalle de las partidas:`);
            matchesWithTarget.forEach(m => {
                console.log(`- Partida ${m.gameId} | Llevaba: ${m.champion} | KDA: ${m.kda} | Resultado: ${m.win}`);
            });
        }

    } catch (error) {
        console.error("[-] Error:", error.message);
    }
}

main();
