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
        
        // 1. Obtener la información del invocador actual
        const summoner = await requestLCU(port, password, '/lol-summoner/v1/current-summoner');
        const puuid = summoner.puuid;

        // 2. Obtener la lista de partidas
        const history = await requestLCU(port, password, `/lol-match-history/v1/products/lol/${puuid}/matches`);
        const games = history.games?.games || [];

        if (games.length === 0) {
            console.log("No se encontraron partidas.");
            return;
        }

        // 3. Tomar la primera partida para verificar si podemos sacar detalles completos
        const testGameId = games[0].gameId;
        console.log(`[*] Solicitando partida individual ${testGameId}...`);
        
        const detailedGame = await requestLCU(port, password, `/lol-match-history/v1/games/${testGameId}`);
        console.log("[+] Partida descargada con éxito.");
        console.log(`Cantidad de participantes en el detalle: ${detailedGame.participants?.length}`);
        console.log(`Cantidad de identidades en el detalle: ${detailedGame.participantIdentities?.length}`);
        
        if (detailedGame.participantIdentities) {
            console.log("\nLista de jugadores encontrados:");
            detailedGame.participantIdentities.forEach(pi => {
                console.log(`- [Part. ${pi.participantId}] ${pi.player?.gameName}#${pi.player?.tagLine} (PUUID: ${pi.player?.puuid})`);
            });
        }

    } catch (error) {
        console.error("[-] Error:", error.message);
    }
}

main();
