const fs = require('fs');
const path = require('path');
const https = require('https');

// Ruta de instalación por defecto de League of Legends en Windows
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
            rejectUnauthorized: false, // Ignorar certificado SSL auto-firmado
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
        console.log("[*] Obteniendo datos del invocador...");
        const summoner = await requestLCU(port, password, '/lol-summoner/v1/current-summoner');
        const puuid = summoner.puuid;
        console.log(`[+] Invocador: ${summoner.gameName}#${summoner.tagLine} (PUUID: ${puuid.substring(0, 15)}...)`);

        // 2. Obtener el historial de partidas
        console.log("[*] Descargando historial de partidas...");
        const history = await requestLCU(port, password, `/lol-match-history/v1/products/lol/${puuid}/matches`);
        
        const games = history.games?.games || [];
        console.log(`\n[+] Encontradas ${games.length} partidas en el historial local:\n`);
        
        console.log(`${"ID Partida".padEnd(15)} | ${"Modo/Cola".padEnd(20)} | ${"Resultado".padEnd(10)}`);
        console.log("-".repeat(55));

        for (const game of games) {
            const gameId = game.gameId;
            const gameMode = game.gameMode || 'UNKNOWN';

            // Buscar tu participante
            let winStatus = "Desconocido";
            const participantIdentity = game.participantIdentities?.find(pi => pi.player?.puuid === puuid);
            if (participantIdentity) {
                const participantId = participantIdentity.participantId;
                const participant = game.participants?.find(p => p.participantId === participantId);
                if (participant) {
                    const win = participant.stats?.win;
                    winStatus = win ? "Victoria" : "Derrota";
                }
            }

            console.log(`${String(gameId).padEnd(15)} | ${gameMode.padEnd(20)} | ${winStatus.padEnd(10)}`);
        }

    } catch (error) {
        console.error("[-] Error:", error.message);
    }
}

main();
