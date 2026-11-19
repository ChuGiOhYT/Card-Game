/**
 * Retoca la COPIA del juego que va dentro de la APK (no ../src).
 *
 *   node movil/preparar-web.js     (lo llama COMPILAR_APK.bat tras `cap sync`)
 *
 * La CSP de index.html solo deja scripts de archivo (`script-src 'self'`). En
 * los WebView modernos Capacitor mete su puente con addDocumentStartJavaScript
 * y eso no le afecta, pero en los viejos lo inyecta como <script> EN LÍNEA
 * dentro de index.html (JSInjector), y la CSP lo bloquearía: sin puente no hay
 * guardado, ni botón atrás, ni salir. Así que en la copia del teléfono se
 * permite el script en línea. El .exe sigue con la CSP estricta.
 */
const fs = require('fs');
const path = require('path');

const indice = path.join(__dirname, 'android', 'app', 'src', 'main', 'assets', 'public', 'index.html');
if (!fs.existsSync(indice)) {
  console.error(`No encuentro ${indice}: ¿se corrió "npx cap sync android"?`);
  process.exit(1);
}
let html = fs.readFileSync(indice, 'utf8');
const antes = "script-src 'self'";
if (html.includes(antes) && !html.includes("script-src 'self' 'unsafe-inline'")) {
  html = html.replace(antes, "script-src 'self' 'unsafe-inline'");
  fs.writeFileSync(indice, html, 'utf8');
  console.log('CSP del teléfono lista (puente de Capacitor permitido).');
} else {
  console.log('CSP del teléfono: nada que cambiar.');
}
