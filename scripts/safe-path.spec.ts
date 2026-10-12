import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { resolveSafePath, resolveSafePathIn } from './safe-path.mjs';

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

    it.each([
        ['an encoded climb, which is only a name', '%2e%2e/%2e%2e/etc', '%2e%2e/%2e%2e/etc'],
        ['unicode', 'ünïcödé/✓.json', 'ünïcödé/✓.json'],
        ['markup', '<script>.json', '<script>.json'],
        ['a query and a fragment', 'a?b#c.json', 'a?b#c.json'],
        ['a very long name', 'x'.repeat(5000), 'x'.repeat(5000)],
    ])('keeps %s inside the base', (_, filePath, expected) => {
        expect(resolveSafePath(filePath, BASE)).toBe(path.join(BASE, expected));
    });

    it('throws on the base itself', () => {
        expect(() => resolveSafePath('.', BASE)).toThrow('Path traversal detected');
    });
});

describe('resolveSafePath with symlinks', () => {
    const dirs: string[] = [];
    const makeDir = () => {
        const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'safe-path-')));
        dirs.push(dir);
        return dir;
    };
    afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

    it('throws on a file symlinked outside the base', () => {
        const base = makeDir();
        const outside = makeDir();
        fs.writeFileSync(path.join(outside, 'secret'), 'x');
        fs.symlinkSync(path.join(outside, 'secret'), path.join(base, 'link'));

        expect(() => resolveSafePath('link', base)).toThrow('Path traversal detected');
    });

    it('throws on a file not yet written under a directory symlinked outside', () => {
        const base = makeDir();
        const outside = makeDir();
        fs.symlinkSync(outside, path.join(base, 'dir'));

        expect(() => resolveSafePath('dir/new.json', base)).toThrow('Path traversal detected');
    });

    it('throws on a dangling symlink, which a write would follow out', () => {
        const base = makeDir();
        fs.symlinkSync(path.join(makeDir(), 'missing'), path.join(base, 'link'));

        expect(() => resolveSafePath('link', base)).toThrow('Dangling symlink');
    });

    it('accepts a symlink that stays inside the base', () => {
        const base = makeDir();
        fs.writeFileSync(path.join(base, 'real.json'), '{}');
        fs.symlinkSync(path.join(base, 'real.json'), path.join(base, 'link.json'));

        expect(resolveSafePath('link.json', base)).toBe(path.join(base, 'link.json'));
    });

    it('accepts a base reached through a symlink', () => {
        const real = makeDir();
        const viaLink = path.join(makeDir(), 'base');
        fs.symlinkSync(real, viaLink);
        fs.writeFileSync(path.join(real, 'file.json'), '{}');

        expect(resolveSafePath(path.join(viaLink, 'file.json'), viaLink)).toBe(
            path.join(viaLink, 'file.json'),
        );
    });
});

describe('resolveSafePath across a symlinked base', () => {
    const dirs: string[] = [];
    afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

    it('accepts the real path of a file under a base given through a symlink', () => {
        const real = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'safe-path-')));
        const holder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'safe-path-')));
        dirs.push(real, holder);
        const viaLink = path.join(holder, 'base');
        fs.symlinkSync(real, viaLink);

        expect(resolveSafePath(path.join(real, 'file.json'), viaLink)).toBe(
            path.join(real, 'file.json'),
        );
    });
});

describe('resolveSafePathIn', () => {
    it('resolves a path inside any of the bases', () => {
        expect(resolveSafePathIn('/second/base/file.json', ['/first/base', '/second/base'])).toBe(
            '/second/base/file.json',
        );
    });

    it('throws on a path outside all of them', () => {
        expect(() => resolveSafePathIn('/etc/hosts', ['/first/base', '/second/base'])).toThrow(
            'Path traversal detected',
        );
    });

    it('passes through a missing path unchanged', () => {
        expect(resolveSafePathIn(undefined, ['/first/base'])).toBeUndefined();
    });
});
