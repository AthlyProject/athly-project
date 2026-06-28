import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  getNodeAutoInstrumentations,
  getResourceDetectors,
} from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter as OTLPTraceExporterGrpc } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as OTLPTraceExporterProto } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPLogExporter as OTLPLogExporterGrpc } from '@opentelemetry/exporter-logs-otlp-grpc';
import { OTLPLogExporter as OTLPLogExporterProto } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { diag, DiagConsoleLogger, DiagLogLevel, SpanStatusCode } from '@opentelemetry/api';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4317';
const protocol = process.env.OTEL_EXPORTER_OTLP_PROTOCOL ?? 'grpc';
const headers = process.env.OTEL_EXPORTER_OTLP_HEADERS ?? 'undefined';

const isGrpc = protocol === 'grpc';

// gRPC local → derive the HTTP port for metrics (metrics exporter is always HTTP/proto).
const httpBase = isGrpc ? endpoint.replace(':4317', ':4318') : endpoint;

const traceExporter = isGrpc
  ? new OTLPTraceExporterGrpc({ url: endpoint })
  : new OTLPTraceExporterProto({ url: `${endpoint}/v1/traces`, headers });

const logExporter = isGrpc
  ? new OTLPLogExporterGrpc({ url: endpoint })
  : new OTLPLogExporterProto({ url: `${endpoint}/v1/logs`, headers });

const metricExporter = new OTLPMetricExporter({
  url: `${httpBase}/v1/metrics`,
  ...(isGrpc ? {} : { headers }),
});

// sdk-node bundles its own sdk-metrics so PeriodicExportingMetricReader types diverge — safe cast.
const sdk = new NodeSDK({
  traceExporter,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 15_000,
  }) as any,
  logRecordProcessors: [new BatchLogRecordProcessor(logExporter)],
  resourceDetectors: getResourceDetectors(),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-http': {
        // responseHook fires at request start (statusCode still default 200).
        // applyCustomAttributesOnSpan fires inside _onServerResponseFinish, after
        // the final status code is written.
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
  diag.info(`[OTel] SDK started — ${endpoint} (${protocol}) ${headers}`);
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
