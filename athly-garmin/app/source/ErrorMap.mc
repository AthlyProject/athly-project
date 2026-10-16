import Toybox.Lang;
import Toybox.WatchUi;

// Código de status (HTTP real, do envelope de erro, ou do runtime) → mensagem para o atleta.
module ErrorMap {
    // Erros do link Bluetooth com o celular (Garmin Connect fechado, celular longe...).
    function isPhoneError(status as Number) as Boolean {
        return status == -104 || status == -2 || status == -3 || status == -4 || status == -5
            || status == -101 || status == -103;
    }

    function message(status as Number) as ResourceId {
        if (status == 401) {
            return Rez.Strings.ErrUnpaired;
        }
        if (isPhoneError(status)) {
            return Rez.Strings.ErrPhone;
        }
        if (status == -300) {
            return Rez.Strings.ErrTimeout;
        }
        if (status == -1001) {
            return Rez.Strings.ErrSecure;
        }
        if (status == -1000 || status == SyncStatus.NOT_SAVED) {
            return Rez.Strings.ErrStorage;
        }
        if (status == SyncStatus.UNSUPPORTED) {
            return Rez.Strings.ErrUnsupported;
        }
        if (status >= 500 || status == -400 || status == -402 || status == -403) {
            return Rez.Strings.ErrServer;
        }
        return Rez.Strings.ErrGeneric;
    }

    function text(status as Number) as String {
        var id = message(status);
        var template = WatchUi.loadResource(id) as String;
        return id == Rez.Strings.ErrGeneric ? Lang.format(template, [status]) : template;
    }
}
