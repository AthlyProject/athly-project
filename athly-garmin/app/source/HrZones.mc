import Toybox.Graphics;
import Toybox.Lang;
import Toybox.UserProfile;

// Zonas de FC de corrida do perfil Garmin do atleta: [mín Z1, máx Z1, máx Z2, máx Z3, máx Z4,
// máx Z5] em bpm — as mesmas que o campo de FC nativo usa.
module HrZones {
    // null sem perfil ou sem a permissão UserProfile: a tela mostra só os bpm.
    function load() as Array<Number>? {
        try {
            var limits = UserProfile.getHeartRateZones(UserProfile.HR_ZONE_SPORT_RUNNING);
            return limits != null && limits.size() >= 6 ? limits : null;
        } catch (e) {
            return null;
        }
    }

    // 1–5, ou 0 abaixo do mínimo da Z1.
    function zoneOf(bpm as Number, limits as Array<Number>) as Number {
        if (bpm < limits[0]) {
            return 0;
        }
        for (var zone = 1; zone < 5; zone++) {
            if (bpm <= limits[zone]) {
                return zone;
            }
        }
        return 5;
    }

    // Cores da Garmin: Z1 cinza, Z2 azul, Z3 verde, Z4 laranja, Z5 vermelho.
    function color(zone as Number) as Graphics.ColorType {
        if (zone == 2) {
            return Graphics.COLOR_BLUE;
        }
        if (zone == 3) {
            return Graphics.COLOR_GREEN;
        }
        if (zone == 4) {
            return Graphics.COLOR_ORANGE;
        }
        if (zone == 5) {
            return Graphics.COLOR_RED;
        }
        return Graphics.COLOR_LT_GRAY;
    }
}
