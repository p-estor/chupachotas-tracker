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

async function main() {
    try {
        const { port, password } = getLCUCredentials();
        console.log(`[+] Conectado al cliente local en el puerto: ${port}`);

        // 1. Obtener la información del invocador actual
        const summoner = await requestLCU(port, password, '/lol-summoner/v1/current-summoner');
        const myPuuid = summoner.puuid;
        console.log(`[+] Invocador: ${summoner.gameName}#${summoner.tagLine}`);

        // 2. Obtener lista de partidas
        console.log("[*] Obteniendo historial general...");
        const history = await requestLCU(port, password, `/lol-match-history/v1/products/lol/${myPuuid}/matches`);
        const games = history.games?.games || [];

        // Filtrar estrictamente por queueId 4310 (LoL Classic)
        const classicGames = games.filter(g => g.queueId === 4310);

        if (classicGames.length === 0) {
            console.log("No se encontraron partidas de LoL Classic (Queue ID: 4310) en tu historial local reciente.");
            return;
        }

        console.log(`[+] Encontradas ${classicGames.length} partidas de LoL Classic (Queue 4310) en el historial local reciente.`);
        // Procesar TODAS las partidas de Classic disponibles en el historial local
        console.log(`[+] Cargando detalles de las ${classicGames.length} partidas...\n`);

        for (let i = 0; i < classicGames.length; i++) {
            const summaryGame = classicGames[i];
            const gameId = summaryGame.gameId;
            const gameMode = summaryGame.gameMode || 'UNKNOWN';
            
            // Obtener detalle completo
            const game = await requestLCU(port, password, `/lol-match-history/v1/games/${gameId}`);
            const durationMin = Math.floor(game.gameDuration / 60);
            
            console.log(`\n========================================================================================`);
            console.log(`PARTIDA ID: ${gameId} | Modo: ${gameMode} (LoL Classic) | Duración: ${durationMin} min`);
            console.log(`========================================================================================`);

            // Mapear identidades por participantId
            const playerMap = {};
            game.participantIdentities?.forEach(pi => {
                playerMap[pi.participantId] = `${pi.player?.gameName}#${pi.player?.tagLine}`;
            });

            // Agrupar participantes por equipo
            const team100 = [];
            const team200 = [];

            game.participants?.forEach(p => {
                const name = playerMap[p.participantId] || "Desconocido";
                const isMe = game.participantIdentities?.find(pi => pi.participantId === p.participantId)?.player?.puuid === myPuuid;
                
                const stats = p.stats || {};
                const kda = `${stats.kills}/${stats.deaths}/${stats.assists}`;
                const dmg = stats.totalDamageDealtToChampions || 0;
                const cs = (stats.totalMinionsKilled || 0) + (stats.neutralMinionsKilled || 0);
                const win = stats.win;

                const playerData = {
                    name: isMe ? `* ${name} *` : name,
                    champion: `Champ ${p.championId}`,
                    kda,
                    dmg,
                    cs,
                    win
                };

                if (p.teamId === 100) team100.push(playerData);
                else team200.push(playerData);
            });

            // Imprimir Equipo 1 (Azul)
            const t1Win = team100[0]?.win ? "VICTORIA" : "DERROTA";
            console.log(`\nEQUIPO AZUL (Team 100) - ${t1Win}:`);
            console.log(`${"Nombre".padEnd(25)} | ${"KDA".padEnd(10)} | ${"Daño".padEnd(8)} | ${"CS".padEnd(5)}`);
            console.log("-".repeat(60));
            team100.forEach(p => {
                console.log(`${p.name.padEnd(25)} | ${p.kda.padEnd(10)} | ${String(p.dmg).padEnd(8)} | ${String(p.cs).padEnd(5)}`);
            });

            // Imprimir Equipo 2 (Rojo)
            const t2Win = team200[0]?.win ? "VICTORIA" : "DERROTA";
            console.log(`\nEQUIPO ROJO (Team 200) - ${t2Win}:`);
            console.log(`${"Nombre".padEnd(25)} | ${"KDA".padEnd(10)} | ${"Daño".padEnd(8)} | ${"CS".padEnd(5)}`);
            console.log("-".repeat(60));
            team200.forEach(p => {
                console.log(`${p.name.padEnd(25)} | ${p.kda.padEnd(10)} | ${String(p.dmg).padEnd(8)} | ${String(p.cs).padEnd(5)}`);
            });
            console.log("\n");
        }

    } catch (error) {
        console.error("[-] Error:", error.message);
    }
}

main();
