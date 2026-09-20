import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  getNodeAutoInstrumentations,
  getResourceDetectors,
} from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { diag, DiagConsoleLogger, DiagLogLevel, SpanStatusCode } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { hostname } from 'os';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4318';

// Grafana Cloud Application Observability bills on host-hours and identifies a host from
// k8s.node.name -> host.id -> grafana.host.id, first match wins. On App Runner the first two
// are unavailable: there is no Kubernetes node, and host.id is read from /etc/machine-id,
// which the alpine runtime image does not ship. Without one of them the service is excluded
// from host-hours accounting. grafana.host.id is the documented opt-in fallback; being the
// lowest priority, a real host.id still takes precedence wherever one exists.
// Per-instance by design - a constant would collapse an autoscaled service to a single host.
const grafanaHostId = process.env.GRAFANA_HOST_ID?.trim() || hostname();

// Supports OTel spec ("Authorization=Basic xxx") and JSON (AWS Secrets Manager default).
const rawHeaders = process.env.OTEL_EXPORTER_OTLP_HEADERS ?? '';
const headers: Record<string, string> = {};
if (rawHeaders.trimStart().startsWith('{')) {
  try {
    Object.assign(headers, JSON.parse(rawHeaders));
  } catch {
    /* invalid JSON */
  }
} else {
  for (const pair of rawHeaders.split(',')) {
    const eq = pair.indexOf('=');
    if (eq > 0) headers[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
}

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'athly-backend',
    'grafana.host.id': grafanaHostId,
  }),
  traceExporter: new OTLPTraceExporter({ url: `${base}/v1/traces`, headers }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: `${base}/v1/metrics`, headers }),
    exportIntervalMillis: 15_000,
  }) as any,
  logRecordProcessors: [
    new BatchLogRecordProcessor(new OTLPLogExporter({ url: `${base}/v1/logs`, headers })),
  ],
  resourceDetectors: getResourceDetectors(),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-http': {
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
  diag.info(
    `[OTel] SDK started — ${base} headers=[${Object.keys(headers).join(', ') || 'none'}] ` +
      `grafana.host.id=${grafanaHostId}`,
  );
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
