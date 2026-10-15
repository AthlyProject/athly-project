import Toybox.Lang;

// (:background): o envio das corridas roda no processo em segundo plano, que só enxerga o código
// marcado assim.
(:background)
module Config {
    // Debug (simulador): backend local com `npm run dev` no athly-backend. Num relógio de verdade,
    // troque pela URL HTTPS do túnel (ver ../README.md): o relógio exige HTTPS válido.
    (:debug) const API_BASE = "http://localhost:4000";
    (:release) const API_BASE = "https://api.athlyproject.app";

    const APP_VERSION = "1.0.0";

    // Só envia corridas confirmadas pelo evento "atividade concluída" — uma corrida descartada no
    // relógio não chega a disparar o evento. Se o spike mostrar que o evento falha em algum relógio,
    // desligar aqui faz o envio acontecer pelo evento temporal.
    const REQUIRE_COMPLETED_EVENT = true;
}
