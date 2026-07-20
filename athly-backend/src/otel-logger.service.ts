import { LoggerService } from '@nestjs/common';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { trace } from '@opentelemetry/api';

const otelLogger = logs.getLogger('athly-backend');

export class OTelLoggerService implements LoggerService {
  log(message: unknown, context?: string) {
    this.emit(SeverityNumber.INFO, 'info', message, context);
  }

  error(message: unknown, stack?: string, context?: string) {
    this.emit(SeverityNumber.ERROR, 'error', message, context, stack);
  }

  warn(message: unknown, context?: string) {
    this.emit(SeverityNumber.WARN, 'warn', message, context);
  }

  debug(message: unknown, context?: string) {
    this.emit(SeverityNumber.DEBUG, 'debug', message, context);
  }

  verbose(message: unknown, context?: string) {
    this.emit(SeverityNumber.TRACE, 'trace', message, context);
  }

  private emit(
    severityNumber: SeverityNumber,
    level: string,
    message: unknown,
    context?: string,
    stack?: string,
  ) {
    const activeSpan = trace.getActiveSpan();
    const spanCtx = activeSpan?.spanContext();

    // Structured body — trace_id in body enables Loki → Tempo correlation in Grafana
    const body: Record<string, unknown> = {
      msg: typeof message === 'string' ? message : JSON.stringify(message),
    };
    if (context) body.context = context;
    if (stack) body.stack = stack;
    if (spanCtx) {
      body.trace_id = spanCtx.traceId;
      body.span_id = spanCtx.spanId;
    }

    otelLogger.emit({
      severityNumber,
      severityText: level.toUpperCase(),
      body: JSON.stringify(body),
      attributes: {
        ...(context && { 'code.namespace': context }),
        ...(stack && { 'exception.stacktrace': stack }),
      },
    });

    // Mirror to stdout for local dev readability (same structure)
    process.stdout.write(JSON.stringify({ time: new Date().toISOString(), level, ...body }) + '\n');
  }
}
