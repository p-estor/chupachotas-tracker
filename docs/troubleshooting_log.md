# Registro General de Problemas y Soluciones (Troubleshooting Log)

Este documento registra problemas técnicos generales, bugs encontrados en producción y decisiones arquitectónicas que no encajan en categorías específicas (como SEO).

## 1. Iconos de perfil de jugador rotos (404 Not Found)
* **El Problema:** Jugadores con iconos nuevos (ej. nueva skin de Orianna) no cargaban su imagen de perfil, mostrando un recuadro roto en el frontend.
* **La Solución:** La constante \DDRAGON_VERSION\ en \rontend/src/constants.js\ estaba desactualizada (\16.13.1\). Se actualizó manualmente a la versión más reciente de la API de Riot (\16.18.1\) para volver a enlazar con el CDN correcto.

## 2. Estadísticas falsas en la pestaña ARAM
* **El Problema:** El dashboard de ARAM mostraba datos inventados (estadísticas *hardcodeadas* con \Math.max\) porque la API original del backend no mapeaba los datos reales de ARAM (Pentakills, Curación total, Poro Snax, etc.). Además, el usuario prefería integrar ARAM como un filtro más en lugar de una pestaña gigante aislada.
* **La Solución:** 
  1. Se modificó \ackend/server.js\ para inyectar en \playerStats\ los datos reales extraídos del objeto \challenges\ de la API de Riot.
  2. Se purgó la tabla \matches\ de SQLite en producción (\DELETE FROM matches;\) para forzar la re-descarga de partidas con el nuevo esquema de datos.
  3. Se rediseñó la UI en React eliminando la pestaña superior de ARAM y restaurando el filtro de cola lateral ("ARAM") en todos los componentes y temas.

## 3. Caída del servidor por falta de espacio (No space left on device)
* **El Problema:** El 24 de Septiembre, el disco del VPS (8.7GB) llegó al 100% de capacidad. La causa principal era la base de datos \ackend/database.sqlite\, que había crecido hasta 1.4GB cacheando miles de partidas, bloqueando operaciones de Nginx y NPM.
* **La Solución:** Se purgó la caché oculta de NPM (\m -rf /root/.npm/*\) liberando ~500MB de urgencia para mantener el servidor operativo. 
* **Acción requerida a futuro:** Ampliar el disco del VPS o implementar un *cronjob* que purgue partidas antiguas de SQLite.

## 4. Llenado recurrente de disco por rastreo de Googlebot (150 partidas por perfil) y compactación de SQLite
* **El Problema:** El 17 de Octubre el disco de 8.7GB volvió a llenarse al 100% (`database.sqlite` llegó a 2.4GB con 55.286 partidas y 420.506 registros en `summoner_directory`), causando errores de búsqueda (`SQLITE_FULL`). Los logs de Nginx revelaron que Googlebot estaba visitando cientos de perfiles del sitemap, ejecutando el bundle de React y disparando peticiones a `/api/matches?count=150&queue=all` que descargaban y guardaban miles de partidas de desconocidos durante toda la noche.
* **La Solución:**
  1. En `backend/server.js` (`/api/matches`), se detecta si el `User-Agent` es un bot/crawler (`Googlebot`, `Bingbot`, etc.). Para bots, se limita `count` a un máximo de 8 partidas, se desactiva `forceRefresh`, se evita indexar participantes en `summoner_directory` y se limita la descarga de partidas no cacheadas a un máximo de 2 para responder de inmediato sin timeouts (`499`) ni inflar el disco.
  2. Se añadió auto-purgado periódico en `backend/server.js` para mantener la caché acotada (~10.000-25.000 partidas recientes) y se compactó `database.sqlite` en el VPS, recuperando ~2GB de espacio libre en `/dev/vda1`.
