# Chupachotas Tracker 📊 (Plataforma de Auditoría y Analíticas de LoL)

Plataforma web autónoma de analíticas y auditoría profunda de perfiles de League of Legends para la región de Europa Occidental (EUW). Este sistema está diseñado para integrarse de forma nativa con el proyecto `soloq-challenge`, permitiendo monitorizar las estadísticas detalladas de cada participante del evento.

Desplegado en producción en: [tracker.chupachotas.es](https://tracker.chupachotas.es)

---

## 🛠️ Stack Tecnológico

El proyecto está diseñado bajo una arquitectura desacoplada en dos capas principales:

*   **Frontend:** React (Single Page Application) estructurado con Vite, utilizando TypeScript y **CSS nativo puro (Vanilla CSS)** con una estética premium oscura basada en micro-animaciones y efectos visuales de cristal (glassmorphism).
*   **Backend:** Node.js y Express encargado de procesar la lógica de negocio, enrutamiento de APIs y consumo del cliente HTTP para la API oficial de Riot Games (utilizando Axios).
*   **Base de Datos (Caché local):** SQLite (gestionado con `sqlite3` y el wrapper `sqlite` de Node.js) para el almacenamiento inmutable de datos históricos.
*   **DevOps & Sistemas:** Servidor VPS Linux, Nginx configurado como proxy inverso, seguridad SSL (Certbot) y gestión persistente de procesos 24/7 mediante **PM2**.

---

## 🧠 Arquitectura y Lógica de Negocio Clave

Para garantizar el rendimiento óptimo del sistema y sortear los límites de peticiones impuestos por la API de Riot Games, la plataforma implementa técnicas avanzadas de diseño de software:

### 1. Sistema de Caché Híbrida Inteligente (SQLite)
*   **Perfiles de Invocador (TTL):** Los datos de perfil se almacenan temporalmente y se refrescan cada 5 minutos para evitar saturar la cuota de la API.
*   **Partidas Inmutables:** El historial de partidas se comporta como una caché de solo lectura. Cuando un usuario solicita su perfil, el backend consulta a Riot los IDs de partidas recientes, contrasta en SQLite cuáles ya están guardadas, y recupera en local dichas partidas en un tiempo récord de **<5ms**. Únicamente se solicita a la API de Riot el scoreboard detallado de las partidas nuevas que no estén en la base de datos local, ahorrando más de un 80% de llamadas externas.

### 2. Buscador Inteligente con Autocompletado
*   **Directorio Dinámico:** El backend indexa automáticamente en la tabla `summoner_directory` los nombres y tags de todos los invocadores consultados, además de registrar a los otros 10 participantes de cada partida analizada.
*   **Optimización del Frontend:** El buscador del frontend implementa un control de **debounce de 250ms** para mitigar peticiones innecesarias al escribir y permite navegación fluida por teclado mediante las flechas de dirección y la tecla `Enter`.

### 3. Métricas de Rendimiento Calculadas en Servidor
*   **MMR / Elo Promedio:** Calcula de forma matemática la media de rango del total de los 10 participantes de cada partida para estimar y mostrar el Elo de la sala (ej. Oro III).
*   **DPM Score & Insignias (MVP/ACE):** Algoritmo propio que evalúa estadísticas complejas (relación KDA, daño por minuto, oro acumulado y puntuación de visión) para calificar la contribución del jugador y otorgar las insignias de MVP (jugador más valioso) o ACE (mejor jugador del equipo perdedor).
*   **Módulo ARAM:** Registro de estadísticas temáticas exclusivas para este modo de juego, incluyendo récords de daño, bolas de nieve acertadas, Poros alimentados e integración visual con mapas de calor y Splash Arts oficiales de Riot Games.

---

## 🔗 Integración con `soloq-challenge` (Next.js)

El tracker funciona de forma integrada con el ranking de la web principal:
1.  **Base de Datos Compartida:** El backend del tracker lee directamente el archivo de base de datos de producción SQLite del SoloQ Challenge (`dev.db`) para mostrar en tiempo real la clasificación activa de sus 18 participantes desde la página de inicio.
2.  **Enrutamiento Dinámico:** El feed de actividad reciente de la web principal redirige las partidas individuales de forma directa al tracker usando la estructura de URLs con query-string:
    `https://tracker.chupachotas.es/euw/{gameName}-{tagLine}?match={matchId}`
    Al abrirse, el tracker localiza al invocador en caché, recupera la partida y realiza un desplazamiento suave de pantalla (*smooth scroll*) para posicionar la partida directamente ante el usuario.

---

## 📦 Instalación y Configuración Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/p-estor/chupachotas-tracker.git
cd chupachotas-tracker
```

### 2. Configurar el Backend
Accede a la carpeta `/backend`, instala las dependencias y configura las variables de entorno en un archivo `.env`:
```bash
cd backend
npm install
```
Crea un archivo `.env` en la raíz de la carpeta `/backend` con los siguientes campos:
```env
PORT=3001
RIOT_API_KEY="tu_riot_api_key_oficial"
DB_PATH="./database.sqlite"
# Enlace a la base de datos de soloq si se integra localmente
SOLOQ_DB_PATH="../soloq_challenge/dev.db" 
```
Inicia el backend en desarrollo:
```bash
npm run dev
```

### 3. Configurar el Frontend
En una nueva terminal, accede a `/frontend`, instala las dependencias e inicia el servidor de desarrollo de Vite:
```bash
cd ../frontend
npm install
npm run dev
```

---

## 🚀 Despliegue en Producción (VPS)

En el servidor de producción Linux, el backend se mantiene activo de forma ininterrumpida mediante el gestor de procesos **PM2** y servido a través de **Nginx**:

```bash
# Iniciar backend asíncrono
pm2 start dist/index.js --name "chupachotas-tracker-backend"

# Configuración básica del bloque de servidor en Nginx (/etc/nginx/sites-available/default)
server {
    server_name tracker.chupachotas.es;

    location / {
        proxy_pass http://localhost:3000; # Puerto de la app
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
y securizado bajo HTTPS mediante **Certbot (Let's Encrypt)**.
