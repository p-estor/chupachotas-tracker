const fs = require('fs');

function processFile(path) {
  let code = fs.readFileSync(path, 'utf8');

  // Inject useTranslation hook
  if (!code.includes("useTranslation")) {
    code = code.replace("import React, { useState } from 'react';", "import React, { useState } from 'react';\nimport { useTranslation } from 'react-i18next';");
    code = code.replace("export default function ", "export default function ");
    // need to insert const { t } = useTranslation(); at the top of the component
    // we'll find the first '{' after 'export default function'
    const funcMatch = code.match(/export default function\s+\w+\s*\([^)]*\)\s*\{/);
    if (funcMatch) {
      const idx = funcMatch.index + funcMatch[0].length;
      code = code.slice(0, idx) + "\n  const { t } = useTranslation();\n" + code.slice(idx);
    }
  }

  // Profile
  code = code.replace(/>Resumen \(Últimas /g, ">{t('profile.summaryTitle', { count: ");
  code = code.replace(/ partidas\)<\/h3>/g, " })}</h3>");
  code = code.replace(/>Victorias</g, ">{t('profile.wins')}<");
  code = code.replace(/>Derrotas</g, ">{t('profile.losses')}<");
  code = code.replace(/>Campeones más jugados</g, ">{t('profile.mostPlayed')}<");
  code = code.replace(/>Puntuación de Visión</g, ">{t('profile.visionScore')}<");
  code = code.replace(/>Todas las Colas</g, ">{t('profile.allQueues')}<");
  code = code.replace(/>Partidas</g, ">{t('profile.tabs.matches')}<");
  code = code.replace(/>Campeones</g, ">{t('profile.tabs.champions')}<");
  code = code.replace(/>ARAM</g, ">{t('profile.tabs.aram')}<");
  code = code.replace(/>En Vivo</g, ">{t('profile.tabs.live')}<");
  
  // Match
  code = code.replace(/>Victoria</g, ">{t('match.win')}<");
  code = code.replace(/>Derrota</g, ">{t('match.loss')}<");
  code = code.replace(/>Remake</g, ">{t('match.remake')}<");
  code = code.replace(/>Mostrar detalles</g, ">{t('match.showMore')}<");
  code = code.replace(/>Ocultar detalles</g, ">{t('match.showLess')}<");

  fs.writeFileSync(path, code);
}

processFile('src/TrackerProfilePro.jsx');
processFile('src/TrackerProfileBroadcast.jsx');
