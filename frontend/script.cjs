const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// Inject useTranslation hook
if (!code.includes("useTranslation")) {
  code = code.replace("import { Helmet } from 'react-helmet-async';", "import { Helmet } from 'react-helmet-async';\nimport { useTranslation } from 'react-i18next';");
  code = code.replace("export default function App() {", "export default function App() {\n  const { t } = useTranslation();");
}

// Nav
code = code.replace(/"Buscar Invocador#TAG\.\.\. \(Ctrl\+K\)"/g, "{t('nav.searchPlaceholder')}");
code = code.replace(/"Buscar Invocador por Nombre y Etiqueta"/g, "{t('nav.searchAria')}");
code = code.replace(/"Seleccionar región"/g, "{t('nav.regionAria')}");
code = code.replace(/☕ Donar/g, "{t('nav.donate')}");

// Landing
code = code.replace(/>Buscar Estadísticas de Invocador</g, ">{t('landing.title')}<");
code = code.replace(/>Análisis en tiempo real de jugadores de League of Legends, tendencias de LP y puntuaciones MVP</g, ">{t('landing.subtitle')}<");
code = code.replace(/"Buscar Invocador Nombre#TAG \(ej\. Faker#KR1\)\.\.\."/g, "{t('landing.searchPlaceholder')}");
code = code.replace(/>\s*Search\s*<\/button>/g, ">{t('landing.searchBtn')}</button>");

// Errors
code = code.replace(/"No se encontraron más partidas\."/g, "t('errors.noMoreMatches')");
code = code.replace(/'Por favor introduce el formato Nombre#TAG \(ej\. Faker#KR1\)'/g, "t('errors.invalidFormat')");
code = code.replace(/'El nombre o el tag no pueden estar vacíos\.'/g, "t('errors.emptyField')");

fs.writeFileSync('src/App.jsx', code);
