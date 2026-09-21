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
