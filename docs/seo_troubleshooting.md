# Registro de Problemas y Soluciones SEO (Chupachotas Tracker)

Este documento registra los problemas técnicos de posicionamiento (SEO) y rendimiento encontrados en el proyecto, así como la solución exacta que se implementó para cada uno.

## 1. Error de Google Search Console: "Crawled - currently not indexed" (Cloaking accidental)
* **El Problema:** Nginx tenía configurado un endpoint \/api/bot-seo\ para devolver un HTML muy básico a los bots de redes sociales (Twitter, Discord) para generar tarjetas con imágenes bonitas. Sin embargo, la regla de Nginx también atrapaba a \googlebot\. Como resultado, Google recibía una página casi vacía en lugar de la aplicación completa de React, por lo que decidía no indexarla por falta de contenido.
* **La Solución:** Se modificó el archivo de configuración de Nginx (\/etc/nginx/sites-available/tracker\) para eliminar a los motores de búsqueda (Googlebot, Bingbot, etc.) de la regla de redirección. Ahora los motores de búsqueda reciben la app en React completa y ejecutan el JS para ver los perfiles reales.

## 2. Error de GSC: "Duplicate without user-selected canonical" (Etiquetas estáticas en SPA)
* **El Problema:** Al ser una Single Page Application (React/Vite), el archivo \index.html\ base siempre tenía el mismo \<title>\ ("Chupachotas Tracker") y la misma descripción. Cuando Googlebot leía distintos perfiles de invocadores, veía que los metadatos eran idénticos y creía que eran páginas duplicadas, negándose a indexarlas de forma independiente.
* **La Solución:** Se inyectó código en \rontend/src/App.jsx\ dentro del \useEffect\ de carga del invocador. Ahora, React modifica dinámicamente el \document.title\, la etiqueta \<meta name="description">\ y añade un \<link rel="canonical">\ único para cada invocador una vez que los datos de la API se cargan. Googlebot, al ejecutar el JS, detecta URLs únicas y ricas.

## 3. Falta de descubrimiento de URLs (Páginas huérfanas)
* **El Problema:** La página principal solo tenía una barra de búsqueda y ningún enlace HTML que un robot pudiera seguir para descubrir los perfiles de los jugadores cacheados.
* **La Solución:** Se creó un endpoint \/api/sitemap.xml\ en \ackend/server.js\ que lee dinámicamente de la base de datos (tabla \summoner_directory\) y genera un mapa en formato XML. Se envió este archivo a Google Search Console.

## 4. Posicionamiento en múltiples idiomas sin enrutamiento de URL
* **El Problema:** El proyecto tiene i18n, pero no cambia la URL según el idioma (ej. no existe \/en/\ ni \/es/\). Esto provoca que Google solo indexe los términos del idioma por defecto, perdiendo búsquedas valiosas en inglés como "LoL Stats" o "Match History".
* **La Solución:** Se aplicó una estrategia de SEO Bilingüe ("Spanglish") en los metadatos dinámicos. El título inyectado por React pasó a ser \[Nombre] - LoL Stats, MMR & Estadísticas...\. De este modo, al estar las palabras clave de ambos idiomas en el VIP del SEO (el Title y el Meta Description), Google indexa el sitio para búsquedas internacionales.

## 5. Rendimiento Lighthouse: "Use efficient cache lifetimes" y "Render-blocking"
* **El Problema:** Lighthouse marcaba una nota de 58 en Performance. Faltaban encabezados de caché para nuestros propios estáticos, y las fuentes de Google se cargaban dentro del CSS mediante \@import\, bloqueando el renderizado.
* **La Solución:** 
  1. Se añadieron cabeceras en Nginx para los archivos de la carpeta \/assets/\: \Cache-Control "public, max-age=31536000, immutable"\.
  2. Se movió la carga de Google Fonts al \index.html\ utilizando \<link rel="preconnect">\, lo que permite descargarlas en paralelo y elimina el cuello de botella del CSS. (Nota: Lighthouse aún avisa de "cache lifetimes" residuales, pero pertenecen al CDN externo de Riot Games, el cual no podemos controlar).

## 6. Error de GSC (Actualización): Validation Failed en "Duplicate sin canonical"
* **El Problema:** La inyección de metadatos mediante React (desde el cliente) era demasiado lenta. Googlebot tomaba una "foto" del HTML antes de que la llamada a la API de Riot terminase, por lo que seguía viendo el título genérico.
* **La Solución:** Se implementó *Server-Side Injection (SSI)*. Nginx ahora intercepta a Googlebot y lo envía a \/api/bot-seo\. El backend lee el \index.html\ real de React, inyecta las etiquetas SEO dinámicas directamente en el código fuente, y devuelve la app completa. Googlebot recibe los metadatos perfectos de forma instantánea.

## 7. Error de GSC: "Duplicate without user-selected canonical" en perfiles inexistentes o eliminados (Soft 404)
* **El Problema:** Googlebot rastreó URLs de invocadores antiguos que cambiaron de nombre o ya no existen en Riot (ej. `hygonskitten-kandi?match=...` o `Challengerina-EGO`). En `/api/bot-seo`, cuando la llamada a la API de Riot fallaba con 404, el bloque `catch` devolvía `index.html` con código HTTP `200 OK`, el `<title>` genérico de la home y sin etiqueta canonical. Googlebot interpretaba esto como un "Soft 404" (duplicado de la página de inicio sin canonical).
* **La Solución:** En el bloque `catch` de `/api/bot-seo` en `backend/server.js`, ahora se inyecta `<meta name="robots" content="noindex, nofollow" />`, se modifica el título a "Invocador no encontrado - Chupachotas Tracker" y se devuelve un código de estado HTTP `404 Not Found`. De este modo, Googlebot descarta inmediatamente estas URLs muertas del índice sin considerarlas duplicados.
