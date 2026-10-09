@preconcurrency import OpenTelemetryApi
@preconcurrency import OpenTelemetrySdk
@preconcurrency import OpenTelemetryProtocolExporterHttp
@preconcurrency import ResourceExtension
@preconcurrency import URLSessionInstrumentation
import Foundation

// Thin observability wrapper over opentelemetry-swift.
// Keeps business logic decoupled from the SDK; swap the provider without touching call sites.
enum OTelClient {
    nonisolated(unsafe) private static var urlSessionInstrumentation: URLSessionInstrumentation?
    static let sessionId = UUID().uuidString

    // Call once at app launch, before any network activity.
    static func start() {
        guard
            let endpointStr = (Bundle.main.object(forInfoDictionaryKey: "OTEL_ENDPOINT") as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines),
            !endpointStr.isEmpty,
            let baseURL = URL(string: endpointStr),
            let scheme = baseURL.scheme?.lowercased(),
            ["http", "https"].contains(scheme),
            // Bail out on a host-less endpoint (e.g. "http:" from an xcconfig "//" comment
            // truncation) — otherwise the exporter posts to "http://v1/traces" and spams -1003.
            let host = baseURL.host?.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: ".")),
            !host.isEmpty
        else { return }

        #if !targetEnvironment(simulator)
        // A local collector runs on the developer's Mac, not on the physical iPhone.
        guard host != "localhost", !host.hasSuffix(".localhost"),
              !host.hasPrefix("127."), host != "::1", host != "[::1]"
        else { return }
        #endif

        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"
        let buildNumber = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "0"

        let resource = DefaultResources().get().merging(other: Resource(attributes: [
            "service.name": AttributeValue.string("athly-ios"),
            "service.version": AttributeValue.string("\(appVersion)+\(buildNumber)"),
            "deployment.environment": AttributeValue.string(buildEnvironment),
            "session.id": AttributeValue.string(sessionId),
        ]))

        var headers: [(String, String)] = []
        if let apiKey = Bundle.main.object(forInfoDictionaryKey: "OTEL_API_KEY") as? String,
           !apiKey.isEmpty {
            headers.append(("Authorization", "Basic \(apiKey)"))
        }

        let traceEndpoint = baseURL.appendingPathComponent("v1/traces")
        let traceExporter = OtlpHttpTraceExporter(
            endpoint: traceEndpoint,
            envVarHeaders: headers.isEmpty ? nil : headers
        )
        let tracerProvider = TracerProviderBuilder()
            .add(spanProcessor: BatchSpanProcessor(spanExporter: traceExporter))
            .with(resource: resource)
            .build()
        OpenTelemetry.registerTracerProvider(tracerProvider: tracerProvider)

        // Export requests must not create more spans and keep the export cycle alive.
        urlSessionInstrumentation = URLSessionInstrumentation(
            configuration: URLSessionInstrumentationConfiguration(
                shouldInstrument: { request in request.url != traceEndpoint }
            )
        )
    }

    // Associates the current user with subsequent spans (call after login).
    static func setUser(id: String) {
        let span = tracer.spanBuilder(spanName: "user.set").startSpan()
        span.setAttribute(key: "user.id", value: id)
        span.end()
    }

    static func clearUser() {
        // No-op: user context is per-session. Reset on next app launch.
    }

    // Start a span manually. Caller is responsible for calling .end().
    @discardableResult
    static func startSpan(_ name: String, attributes: [String: String] = [:]) -> any Span {
        let span = tracer.spanBuilder(spanName: name).startSpan()
        for (key, value) in attributes {
            span.setAttribute(key: key, value: value)
        }
        return span
    }

    // Fire-and-forget event (span that immediately ends).
    static func addEvent(_ name: String, attributes: [String: String] = [:]) {
        let span = tracer.spanBuilder(spanName: name).startSpan()
        for (key, value) in attributes {
            span.setAttribute(key: key, value: value)
        }
        span.end()
    }

    // Records a non-fatal error as a span with error status.
    static func recordError(_ error: Error, context: [String: String] = [:]) {
        let span = tracer.spanBuilder(spanName: "exception").startSpan()
        span.setAttribute(key: "exception.message", value: error.localizedDescription)
        for (key, value) in context {
            span.setAttribute(key: key, value: value)
        }
        span.status = .error(description: error.localizedDescription)
        span.end()
    }

    // Current trace ID — useful for correlating iOS events with backend logs.
    static var currentTraceId: String? {
        OpenTelemetry.instance.contextProvider.activeSpan?.context.traceId.hexString
    }

    private static var tracer: any Tracer {
        OpenTelemetry.instance.tracerProvider.get(
            instrumentationName: "athly-ios",
            instrumentationVersion: "1.0.0"
        )
    }

    private static var buildEnvironment: String {
        #if DEBUG
        return "debug"
        #else
        return "production"
        #endif
    }
}
