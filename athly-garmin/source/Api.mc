import Toybox.Communications;
import Toybox.Lang;
import Toybox.PersistedContent;
import Toybox.System;

// Convenções das chamadas ao backend da Athly (rotas /connect-iq/*).
module Api {
    function url(path as String) as String {
        return Config.API_BASE + path;
    }

    // Só o token. É o único header permitido nos downloads FIT: um Content-Type JSON numa
    // requisição FIT quebra nos relógios (funciona no simulador).
    function authHeaders(token as String) as Dictionary {
        return { "Authorization" => "Bearer " + token };
    }

    // POST com corpo JSON (sem isso o runtime manda form-urlencoded).
    function jsonPostHeaders(token as String?) as Dictionary {
        var headers = { "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON } as Dictionary;
        if (token != null) {
            headers["Authorization"] = "Bearer " + token;
        }
        return headers;
    }

    // As rotas JSON do relógio respondem erro como HTTP 200 + {statusCode, code, message}: nos
    // relógios, status != 200 chega achatado (0 ou -300). O status real vem do corpo.
    function status(responseCode as Number, data as Dictionary or String or PersistedContent.Iterator or Null) as Number {
        if (responseCode == 200 && data instanceof Dictionary) {
            var code = (data as Dictionary)["statusCode"];
            if (code instanceof Number) {
                return code as Number;
            }
        }
        return responseCode;
    }

    // Metadados enviados ao pedir o código de pareamento.
    function deviceInfo() as Dictionary<Object, Object> {
        var settings = System.getDeviceSettings();
        var info = {
            "partNumber" => settings.partNumber,
            "apiLevel" => Lang.format("$1$.$2$.$3$", settings.monkeyVersion),
            "appVersion" => Config.APP_VERSION,
        } as Dictionary<Object, Object>;
        // Identifica o relógio físico: re-parear o mesmo relógio substitui o registro antigo.
        var uid = (settings has :uniqueIdentifier) ? settings.uniqueIdentifier : null;
        if (uid != null) {
            info["uid"] = uid;
        }
        return info;
    }
}
