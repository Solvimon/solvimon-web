import { ref } from 'vue';
import {
    createCustomElementLogSink,
    createLogger,
    createLoggingContext,
    serializeError,
} from './LoggerProvider.lib';
import type { LogEntry, LogSink } from './LoggerProvider.types';

describe('serializeError', () => {
    it('returns undefined for falsy values', () => {
        expect(serializeError(null)).toBeUndefined();
        expect(serializeError(undefined)).toBeUndefined();
        expect(serializeError(0)).toBeUndefined();
        expect(serializeError('')).toBeUndefined();
    });

    it('serializes an Error instance', () => {
        const err = new Error('boom');
        const result = serializeError(err);
        expect(result).toEqual({
            name: 'Error',
            message: 'boom',
            stack: err.stack,
            cause: undefined,
        });
    });

    it('serializes an Error with a cause', () => {
        const cause = new Error('root cause');
        const err = new Error('outer', { cause });
        expect(serializeError(err)?.cause).toBe(cause);
    });

    it('serializes a plain object with error-like fields', () => {
        const obj = { name: 'CustomError', message: 'something went wrong', stack: 'at ...' };
        expect(serializeError(obj)).toEqual({ name: 'CustomError', message: 'something went wrong', stack: 'at ...', cause: undefined });
    });

    it('falls back to String() for primitives', () => {
        expect(serializeError(42)).toEqual({ message: '42' });
        expect(serializeError(true)).toEqual({ message: 'true' });
    });
});

describe('createLoggingContext', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'location', {
            value: { origin: 'https://example.com', pathname: '/billing', href: 'https://example.com/billing?token=secret' },
            writable: true,
        });
    });

    it('includes origin + pathname but not query string', () => {
        const result = createLoggingContext();
        expect(result.url).toBe('https://example.com/billing');
        expect(result.url).not.toContain('secret');
    });

    it('includes componentName and environment when provided', () => {
        const result = createLoggingContext({}, 'solvimon-checkout', 'LIVE');
        expect(result.componentName).toBe('solvimon-checkout');
        expect(result.environment).toBe('LIVE');
    });

    it('merges extra context fields', () => {
        const result = createLoggingContext({ invoiceId: 'inv_123' });
        expect(result.invoiceId).toBe('inv_123');
    });

    it('context fields override defaults', () => {
        const result = createLoggingContext({ url: 'https://override.example' });
        expect(result.url).toBe('https://override.example');
    });
});

describe('createLogger', () => {
    let sink: ReturnType<typeof vi.fn<LogSink>>;
    let lastEntry: () => LogEntry;

    beforeEach(() => {
        sink = vi.fn();
        lastEntry = () => sink.mock.calls[sink.mock.calls.length - 1][0];
    });

    describe('log level filtering', () => {
        it('emits entries at or above the configured logLevel', () => {
            const logger = createLogger(sink, { logLevel: 'warn' });
            logger.warn('ADYEN_INVALID_CONFIGURATION', 'msg');
            logger.error('INTEGRATION_ERROR', 'msg');
            expect(sink).toHaveBeenCalledTimes(2);
        });

        it('suppresses entries below the configured logLevel', () => {
            const logger = createLogger(sink, { logLevel: 'warn' });
            logger.debug('DEBUG_CODE', 'msg');
            logger.info('INFO_CODE', 'msg');
            expect(sink).not.toHaveBeenCalled();
        });

        it('defaults to warn level when logLevel is not set', () => {
            const logger = createLogger(sink);
            logger.debug('DEBUG_CODE', 'msg');
            logger.info('INFO_CODE', 'msg');
            expect(sink).not.toHaveBeenCalled();
            logger.warn('WARN_CODE', 'msg');
            expect(sink).toHaveBeenCalledTimes(1);
        });
    });

    describe('log entry shape', () => {
        it('includes schemaVersion, level, code, message, and ISO timestamp', () => {
            const logger = createLogger(sink, { logLevel: 'info' });
            logger.info('INFO_CODE', 'hello');
            const entry = lastEntry();
            expect(entry.schemaVersion).toBe(1);
            expect(entry.level).toBe('info');
            expect(entry.code).toBe('INFO_CODE');
            expect(entry.message).toBe('hello');
            expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });

        it('attaches serialized error on error()', () => {
            const logger = createLogger(sink);
            const err = new Error('fail');
            logger.error('INTEGRATION_ERROR', 'something broke', {}, err);
            const entry = lastEntry();
            expect(entry.error).toBe(err);
            expect(entry.errorSerialized?.message).toBe('fail');
        });

        it('attaches serialized error on warn()', () => {
            const logger = createLogger(sink);
            const err = new Error('warning');
            logger.warn('ADYEN_INVALID_CONFIGURATION', 'degraded', {}, err);
            expect(lastEntry().errorSerialized?.message).toBe('warning');
        });
    });

    describe('capture()', () => {
        it('uses UNHANDLED_ERROR code and default message when context is absent', () => {
            const logger = createLogger(sink);
            logger.capture(new Error('oops'));
            expect(lastEntry().code).toBe('UNHANDLED_ERROR');
            expect(lastEntry().message).toBe('Unhandled error');
            expect(lastEntry().level).toBe('error');
        });

        it('uses code and message from context when provided', () => {
            const logger = createLogger(sink);
            logger.capture(new Error('oops'), { code: 'PAYMENT_AUTHORIZATION_FAILED', message: 'payment failed' });
            expect(lastEntry().code).toBe('PAYMENT_AUTHORIZATION_FAILED');
            expect(lastEntry().message).toBe('payment failed');
        });

        it('does not leak code/message into the context field', () => {
            const logger = createLogger(sink);
            logger.capture(new Error('oops'), { code: 'RESOURCE_REVOKED', message: 'gone', extra: 'val' });
            const ctx = lastEntry().context as Record<string, unknown>;
            expect(ctx.code).toBeUndefined();
            expect(ctx.message).toBeUndefined();
            expect(ctx.extra).toBe('val');
        });
    });

    describe('context enrichment', () => {
        it('adds componentName and environment to every entry', () => {
            const logger = createLogger(sink, { customElementName: 'solvimon-checkout', environment: 'LIVE' });
            logger.warn('WARN_CODE', 'msg');
            const ctx = lastEntry().context as Record<string, unknown>;
            expect(ctx.componentName).toBe('solvimon-checkout');
            expect(ctx.environment).toBe('LIVE');
        });
    });
});

describe('createCustomElementLogSink', () => {
    it('always calls the wrapped sink', () => {
        const inner = vi.fn();
        const hostRef = ref<HTMLElement | null>(null);
        const sink = createCustomElementLogSink(inner, hostRef);
        const entry = { schemaVersion: 1 } as LogEntry;
        sink(entry);
        expect(inner).toHaveBeenCalledWith(entry);
    });

    it('does not dispatch a DOM event when hostRef is null', () => {
        const inner = vi.fn();
        const hostRef = ref<HTMLElement | null>(null);
        const sink = createCustomElementLogSink(inner, hostRef);
        sink({ schemaVersion: 1 } as LogEntry);
        // no error thrown and inner was still called
        expect(inner).toHaveBeenCalledTimes(1);
    });

    it('dispatches a composed log event on the host element', () => {
        const inner = vi.fn();
        const host = document.createElement('div');
        const hostRef = ref<HTMLElement | null>(host);
        const sink = createCustomElementLogSink(inner, hostRef);

        const received: CustomEvent[] = [];
        host.addEventListener('log', (e) => received.push(e as CustomEvent));

        const entry = { schemaVersion: 1, level: 'error' } as LogEntry;
        sink(entry);

        expect(received).toHaveLength(1);
        expect(received[0].detail).toBe(entry);
        expect(received[0].bubbles).toBe(true);
        expect(received[0].composed).toBe(true);
    });
});
