import Toybox.Communications;
import Toybox.Lang;
import Toybox.PersistedContent;
import Toybox.System;

// Convenções das chamadas ao backend (rotas /connect-iq/*), as mesmas do app de treinos
// (../source/Api.mc). Cópia enxuta: o campo de dados é outro app e precisa de (:background).
(:background)
module FieldApi {
    function url(path as String) as String {
        return Config.API_BASE + path;
    }

    // POST com corpo JSON (sem isso o runtime manda form-urlencoded).
    function jsonPost(token as String?) as {
        :method as Communications.HttpRequestMethod,
        :headers as Dictionary,
        :responseType as Communications.HttpResponseContentType
    } {
        var headers = { "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON } as Dictionary;
        if (token != null) {
            headers["Authorization"] = "Bearer " + token;
        }
        return {
            :method => Communications.HTTP_REQUEST_METHOD_POST,
            :headers => headers,
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
        };
    }

    function get(token as String) as {
        :method as Communications.HttpRequestMethod,
        :headers as Dictionary,
        :responseType as Communications.HttpResponseContentType
    } {
        return {
            :method => Communications.HTTP_REQUEST_METHOD_GET,
            :headers => { "Authorization" => "Bearer " + token },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
        };
    }

    // As rotas do relógio respondem erro como HTTP 200 + {statusCode, code, message}: nos
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

    // Erros do link Bluetooth com o celular (Garmin Connect fechado, celular longe...).
    function isPhoneError(status as Number) as Boolean {
        return status == -104 || status == -2 || status == -3 || status == -4 || status == -5
            || status == -101 || status == -103 || status == -300;
    }
}
