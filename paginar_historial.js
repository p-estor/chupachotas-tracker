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

        // 1. Obtener la cuenta actual
        const summoner = await requestLCU(port, password, '/lol-summoner/v1/current-summoner');
        const myPuuid = summoner.puuid;
        console.log(`[+] Invocador activo: ${summoner.gameName}#${summoner.tagLine}`);

        // 2. Traer 100 partidas paginando de 20 en 20
        let allGames = [];
        let begIndex = 0;
        let endIndex = 20;

        console.log("[*] Descargando las últimas 100 partidas del cliente local...");

        while (begIndex < 100) {
            const endpoint = `/lol-match-history/v1/products/lol/${myPuuid}/matches?begIndex=${begIndex}&endIndex=${endIndex}`;
            const history = await requestLCU(port, password, endpoint);
            const games = history.games?.games || [];

            if (games.length === 0) {
                console.log(`[-] El cliente no tiene más partidas almacenadas a partir del índice ${begIndex}.`);
                break;
            }

            allGames = allGames.concat(games);
            console.log(`[+] Descargadas partidas de la ${begIndex + 1} a la ${allGames.length}`);

            if (games.length < 20) {
                // Llegamos al límite de partidas totales en el historial local antes de 100
                break;
            }

            begIndex += 20;
            endIndex += 20;
        }

        console.log(`\n[+] Descarga finalizada. Total de partidas leídas del cliente: ${allGames.length}`);

        // 3. Filtrar por LoL Classic (Queue ID 4310)
        const classicGames = allGames.filter(g => g.queueId === 4310);
        console.log(`[+] Partidas correspondientes a LoL Classic (Queue 4310): ${classicGames.length}`);

        if (classicGames.length > 0) {
            console.log("\nListado de partidas de LoL Classic encontradas en el rango escaneado:");
            console.log(`${"Nº".padEnd(4)} | ${"Game ID".padEnd(15)} | ${"Resultado".padEnd(10)} | ${"Creación".padEnd(25)}`);
            console.log("-".repeat(60));
            
            classicGames.forEach((game, index) => {
                let winStatus = "Desconocido";
                const participantIdentity = game.participantIdentities?.find(pi => pi.player?.puuid === myPuuid);
                if (participantIdentity) {
                    const participant = game.participants?.find(p => p.participantId === participantIdentity.participantId);
                    if (participant) {
                        winStatus = participant.stats?.win ? "Victoria" : "Derrota";
                    }
                }
                const dateStr = game.gameCreationDate ? new Date(game.gameCreationDate).toLocaleString() : 'Desconocida';
                console.log(`${String(index + 1).padEnd(4)} | ${String(game.gameId).padEnd(15)} | ${winStatus.padEnd(10)} | ${dateStr.padEnd(25)}`);
            });
        }

    } catch (error) {
        console.error("[-] Error:", error.message);
    }
}

main();
