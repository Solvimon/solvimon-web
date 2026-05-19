import path from 'path';
import { describe, it, expect } from 'vitest';
import { resolveSafePath } from './safe-path.mjs';

const BASE = '/allowed/base';

describe('resolveSafePath', () => {
    it('returns a resolved path for a safe filename', () => {
        expect(resolveSafePath('en-US.json', BASE)).toBe(path.join(BASE, 'en-US.json'));
    });

    it('returns a resolved path for a safe absolute path within base', () => {
        expect(resolveSafePath('/allowed/base/en-US.json', BASE)).toBe('/allowed/base/en-US.json');
    });

    it('throws on a traversal via ../', () => {
        expect(() => resolveSafePath('../etc/passwd', BASE)).toThrow('Path traversal detected');
    });

    it('throws when an absolute path escapes the base directory', () => {
        expect(() => resolveSafePath('/etc/passwd', BASE)).toThrow('Path traversal detected');
    });

    it('throws on deeply nested traversal', () => {
        expect(() => resolveSafePath('sub/../../etc/passwd', BASE)).toThrow(
            'Path traversal detected',
        );
    });

    it('passes through null unchanged', () => {
        expect(resolveSafePath(null, BASE)).toBeNull();
    });

    it('passes through undefined unchanged', () => {
        expect(resolveSafePath(undefined, BASE)).toBeUndefined();
    });
});
