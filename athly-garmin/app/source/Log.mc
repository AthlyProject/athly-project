import Toybox.Lang;
import Toybox.System;
import Toybox.Time;

// Diagnóstico. No simulador vai para o console (monkeydo); num relógio de verdade, para
// GARMIN/APPS/LOGS/ATHLY.TXT — só se esse arquivo existir (crie um arquivo vazio com esse nome pelo
// cabo USB). Sem o arquivo, não faz nada, então pode ficar no release.
(:background)
module Log {
    function d(message as String) as Void {
        System.println(Time.now().value() + " " + message);
    }
}
