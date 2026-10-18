import Toybox.Lang;

// (:background): o envio das corridas que sobraram roda no processo em segundo plano.
(:background)
module Config {
    // Debug (simulador): backend local com `npm run dev` no athly-backend. Para testar num relógio
    // de verdade, troque pela URL HTTPS do túnel (ver README): o relógio faz as requisições pelo
    // celular e exige HTTPS válido.
    (:debug) const API_BASE = "http://localhost:4000";
    (:release) const API_BASE = "https://api.athlyproject.app";

    // 2.x = app único (grava e envia as corridas); o backend usa a versão para saber disso
    // (ConnectIqDeviceModel.uploadsRuns). `make app-build` sobe o último número a cada build.
    const APP_VERSION = "2.0.3";

    // Prazo de cada requisição. Alguns firmwares nunca chamam o callback de um download FIT.
    const REQUEST_TIMEOUT_MS = 30000;
}
