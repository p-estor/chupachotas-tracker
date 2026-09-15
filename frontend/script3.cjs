const fs = require('fs');

let code = fs.readFileSync('src/App.jsx', 'utf8');

// Replace remaining texts in App.jsx
code = code.replace(/>Resumen General</g, ">{t('profile.summaryTitle', { count: matches.length })}<");
code = code.replace(/>Resumen</g, ">{t('profile.tabs.matches')}<");
code = code.replace(/>Victorias</g, ">{t('profile.wins')}<");
code = code.replace(/>Derrotas</g, ">{t('profile.losses')}<");
code = code.replace(/>Victoria</g, ">{t('match.win')}<");
code = code.replace(/>Derrota</g, ">{t('match.loss')}<");
code = code.replace(/>Remake</g, ">{t('match.remake')}<");
code = code.replace(/>Mostrar detalles</g, ">{t('match.showMore')}<");
code = code.replace(/>Ocultar detalles</g, ">{t('match.showLess')}<");
code = code.replace(/>Todas las Colas</g, ">{t('profile.allQueues')}<");
code = code.replace(/>Partidas</g, ">{t('profile.tabs.matches')}<");
code = code.replace(/>Campeones</g, ">{t('profile.tabs.champions')}<");
code = code.replace(/>ARAM</g, ">{t('profile.tabs.aram')}<");
code = code.replace(/>En Vivo</g, ">{t('profile.tabs.live')}<");
code = code.replace(/>Campeones más jugados</g, ">{t('profile.mostPlayed')}<");
code = code.replace(/>Puntuación de Visión</g, ">{t('profile.visionScore')}<");

fs.writeFileSync('src/App.jsx', code);
