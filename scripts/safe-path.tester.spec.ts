import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolveSafePath } from './safe-path.mjs';

/**
 * resolveSafePath compares real paths only and returns the path as written.
 *
 * root/base/ok, root/base/sub/up -> .., root/base/dirlink -> outside, ...
 * root/outside/secret, root/outside/intobase -> base/ok, root/outside/basedirlink -> base
 * root/baselink -> base
 */
let root: string;
let base: string;
let outside: string;

beforeAll(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'safe-path-tester-')));
    base = path.join(root, 'base');
    outside = path.join(root, 'outside');
    fs.mkdirSync(base);
    fs.mkdirSync(outside);
    fs.mkdirSync(path.join(base, 'sub'));
    fs.writeFileSync(path.join(base, 'ok'), 'x');
    fs.writeFileSync(path.join(outside, 'secret'), 'x');
    fs.symlinkSync(outside, path.join(base, 'dirlink'));
    fs.symlinkSync(path.join(outside, 'secret'), path.join(base, 'filelink'));
    fs.symlinkSync('../outside/secret', path.join(base, 'relout'));
    fs.symlinkSync('ok', path.join(base, 'relinside'));
    fs.symlinkSync(path.join(root, 'nowhere'), path.join(base, 'dangling'));
    fs.symlinkSync(path.join(base, 'loop2'), path.join(base, 'loop1'));
    fs.symlinkSync(path.join(base, 'loop1'), path.join(base, 'loop2'));
    fs.symlinkSync('..', path.join(base, 'sub', 'up'));
    fs.symlinkSync(path.join(base, 'ok'), path.join(outside, 'intobase'));
    fs.symlinkSync(base, path.join(outside, 'basedirlink'));
    fs.symlinkSync(base, path.join(root, 'baselink'));
});

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('resolveSafePath escape matrix', () => {
    it.each([
        ['a climb', () => ['../outside/secret', base]],
        ['a climb through a subdirectory', () => ['sub/../../outside/secret', base]],
        ['an absolute path outside', () => [path.join(outside, 'secret'), base]],
        ['a file symlinked out', () => ['filelink', base]],
        ['a file under a directory symlinked out', () => ['dirlink/secret', base]],
        ['a new file under a directory symlinked out', () => ['dirlink/new-output.json', base]],
        ['a relative symlink out', () => ['relout', base]],
        ['the base itself', () => ['.', base]],
        [
            'a file symlinked out, reached through a symlinked base',
            () => ['dirlink/secret', path.join(root, 'baselink')],
        ],
        ['/tmp/../etc/hosts', () => ['/tmp/../etc/hosts', '/tmp']],
    ])('refuses %s', (_, args) => {
        const [filePath, baseDir] = args();
        expect(() => resolveSafePath(filePath, baseDir)).toThrow('Path traversal detected');
    });

    it.each([
        ['a dangling symlink', 'dangling'],
        ['a child of a dangling symlink', 'dangling/child.json'],
    ])('refuses %s', (_, filePath) => {
        expect(() => resolveSafePath(filePath, base)).toThrow('Dangling symlink');
    });

    it('refuses a symlink loop', () => {
        expect(() => resolveSafePath('loop1', base)).toThrow(/ELOOP/);
    });

    it('refuses a NUL byte', () => {
        expect(() => resolveSafePath('ok\0', base)).toThrow();
    });

    it.each([
        ['an existing file', () => ['ok', base], () => path.join(base, 'ok')],
        [
            'a new output file',
            () => ['new-output.json', base],
            () => path.join(base, 'new-output.json'),
        ],
        [
            'a new file in new directories',
            () => ['a/b/c.json', base],
            () => path.join(base, 'a/b/c.json'),
        ],
        [
            'a relative symlink that stays inside',
            () => ['relinside', base],
            () => path.join(base, 'relinside'),
        ],
        [
            'a file under a symlinked base',
            () => ['ok', path.join(root, 'baselink')],
            () => path.join(root, 'baselink', 'ok'),
        ],
        [
            'the real path under a symlinked base',
            () => [path.join(base, 'ok'), path.join(root, 'baselink')],
            () => path.join(base, 'ok'),
        ],
    ])('accepts %s, returned as written', (_, args, expected) => {
        const [filePath, baseDir] = args();
        expect(resolveSafePath(filePath, baseDir)).toBe(expected());
    });

    // Since a9e37fad: lexically outside the base, but through a symlink outside the base that
    // points back into it. Accepted, and the outside path is returned, so the caller's later
    // open goes through a link the check does not own and anyone who can write to `outside`
    // can re-point it between check and use. Before a9e37fad the lexical check refused these.
    it.each([
        ['a file symlinked into the base from outside', () => path.join(outside, 'intobase')],
        [
            'a new file under a directory symlinked into the base from outside',
            () => path.join(outside, 'basedirlink', 'new.json'),
        ],
        ['a climb out and back in through such a link', () => '../outside/basedirlink/ok'],
    ])('accepts %s and returns the outside path', (_, filePath) => {
        const resolved = resolveSafePath(filePath(), base);
        expect(resolved.startsWith(outside + path.sep)).toBe(true);
    });
});
