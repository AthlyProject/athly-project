import Toybox.Lang;

// (:background): o envio das corridas roda no processo em segundo plano, que só enxerga o código
// marcado assim.
(:background)
module Config {
    // Debug (simulador): backend local com `npm run dev` no athly-backend. Num relógio de verdade,
    // troque pela URL HTTPS do túnel (ver ../README.md): o relógio exige HTTPS válido.
    (:debug) const API_BASE = "http://localhost:4000";
    (:release) const API_BASE = "https://api.athlyproject.app";

    // Aparece no campo antes de iniciar a corrida: é como saber qual build está no relógio.
    // Subir a cada build instalado.
    const APP_VERSION = "1.0.2";

    // true: só envia corridas confirmadas pelo evento "atividade concluída" (uma corrida descartada
    // não dispara o evento). Desligado porque, no relógio de teste, corridas salvas não chegaram:
    // sem a confirmação toda corrida com 60 s+ de cronômetro é enviada, e uma descartada aparece
    // no app para o atleta ignorar — melhor que perder corrida. Religar depois de confirmar o evento.
    const REQUIRE_COMPLETED_EVENT = false;
}
