import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  getNodeAutoInstrumentations,
  getResourceDetectors,
} from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { diag, DiagConsoleLogger, DiagLogLevel, SpanStatusCode } from '@opentelemetry/api';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

// Explicit exporter construction bypasses BasicTracerProvider._buildExporterFromEnv(),
// which silently falls back to NoopSpanProcessor when the 'otlp' factory is not
// registered in its static _registeredExporters map.
const grpcEndpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4317';

// sdk-node bundles its own sdk-metrics, so PeriodicExportingMetricReader imported from
// the top-level sdk-metrics triggers a TS "private property mismatch" — safe to cast.
const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: grpcEndpoint }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${grpcEndpoint.replace(':4317', ':4318')}/v1/metrics`,
    }),
    exportIntervalMillis: 15_000,
  }) as any,
  logRecordProcessors: [
    new BatchLogRecordProcessor(new OTLPLogExporter({ url: grpcEndpoint })),
  ],
  resourceDetectors: getResourceDetectors(),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-http': {
        // responseHook fires at request start (statusCode still 200); use
        // applyCustomAttributesOnSpan which fires inside _onServerResponseFinish
        // after the final status code is set.
        applyCustomAttributesOnSpan(span, _request, response) {
          const status = (response as { statusCode?: number }).statusCode;
          if (typeof status === 'number' && status >= 400) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: String(status) });
          }
        },
      },
    }),
  ],
});

try {
  sdk.start();
  diag.info(`[OTel] SDK started — exporting to ${grpcEndpoint}`);
} catch (err) {
  diag.error('[OTel] SDK failed to start', err as Error);
}

async function shutdown() {
  try {
    await sdk.shutdown();
  } catch (err) {
    diag.error('[OTel] Error shutting down SDK', err as Error);
  }
}

process.on('SIGTERM', shutdown);
process.once('beforeExit', shutdown);
