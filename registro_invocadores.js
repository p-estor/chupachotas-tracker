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
        console.log(`[+] Conectado al cliente local (Puerto LCU: ${port})`);

        // 1. Obtener la información del invocador actual (para la cuenta nueva que acabas de abrir)
        const summoner = await requestLCU(port, password, '/lol-summoner/v1/current-summoner');
        const myPuuid = summoner.puuid;
        console.log(`[+] Cuenta detectada: ${summoner.gameName}#${summoner.tagLine}`);

        // 2. Obtener la lista de partidas
        console.log("[*] Obteniendo el historial de partidas...");
        const history = await requestLCU(port, password, `/lol-match-history/v1/products/lol/${myPuuid}/matches`);
        const games = history.games?.games || [];

        // FILTRADO ESTRICTO: Solo queueId 4310 que garantiza 100% que sea LoL Classic
        const classicGames = games.filter(g => g.queueId === 4310);

        if (classicGames.length === 0) {
            console.log("[-] No se encontraron partidas de LoL Classic (Queue ID: 4310) en esta cuenta.");
            return;
        }

        console.log(`[+] Encontradas ${classicGames.length} partidas de LoL Classic.`);
        
        // Usamos un Set para almacenar todos los nombres de invocador únicos (formato Nombre#Tag)
        const summonersSet = new Set();

        for (let i = 0; i < classicGames.length; i++) {
            const gameId = classicGames[i].gameId;
            // Obtener el detalle completo para traer los 10 jugadores
            const game = await requestLCU(port, password, `/lol-match-history/v1/games/${gameId}`);
            
            game.participantIdentities?.forEach(pi => {
                if (pi.player && pi.player.gameName && pi.player.tagLine) {
                    const summonerName = `${pi.player.gameName}#${pi.player.tagLine}`;
                    summonersSet.add(summonerName);
                }
            });
        }

        const summonersList = Array.from(summonersSet).sort((a, b) => a.localeCompare(b));

        console.log(`\n======================================================================`);
        console.log(`REGISTRO DE INVOCADORES ÚNICOS EN PARTIDAS DE LOL CLASSIC (${summonersList.length})`);
        console.log(`======================================================================`);
        summonersList.forEach((name, index) => {
            console.log(`${String(index + 1).padStart(3, ' ')}. ${name}`);
        });
        console.log(`======================================================================\n`);

    } catch (error) {
        console.error("[-] Error:", error.message);
    }
}

main();
