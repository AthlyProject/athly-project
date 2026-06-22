import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { logs } from '@opentelemetry/api-logs';
import { Resource } from '@opentelemetry/resources';

const resource = new Resource({
  'service.name': process.env.OTEL_SERVICE_NAME ?? 'athly-backend',
  'service.version': process.env.npm_package_version ?? '0.0.1',
  'deployment.environment': process.env.NODE_ENV ?? 'development',
});

// Log provider — must be set up before NodeSDK so log emission works during bootstrap
const loggerProvider = new LoggerProvider({ resource });
loggerProvider.addLogRecordProcessor(
  new BatchLogRecordProcessor(new OTLPLogExporter()),
);
logs.setGlobalLoggerProvider(loggerProvider);

// Metrics are auto-configured via OTEL_METRICS_EXPORTER=otlp env var (avoids sdk-metrics
// version mismatch between sdk-node's internal copy and the top-level install).
const sdk = new NodeSDK({
  resource,
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [
    getNodeAutoInstrumentations({
      // fs instrumentation is too noisy for a typical NestJS app
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => loggerProvider.shutdown())
    .finally(() => process.exit(0));
});
