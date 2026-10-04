import Toybox.Lang;

module Config {
    // Debug (simulador): backend local com `npm run dev` no athly-backend. Para testar num relógio
    // de verdade, troque pela URL HTTPS do túnel (ver README): o relógio faz as requisições pelo
    // celular e exige HTTPS válido.
    (:debug) const API_BASE = "http://localhost:4000";
    (:release) const API_BASE = "https://api.athlyproject.app";

    const APP_VERSION = "1.0.0";

    // Prazo de cada requisição. Alguns firmwares nunca chamam o callback de um download FIT.
    const REQUEST_TIMEOUT_MS = 30000;
}
