import { describe, it, expect } from 'vitest';
import {
    collectBundledPackages,
    installedPackageDir,
    licenseProblems,
    packageDirOf,
    renderThirdPartyLicenses,
} from './third-party-licenses.mjs';

const pkg = (name: string, extra: Record<string, string | undefined> = {}) => ({
    name,
    version: '1.0.0',
    license: 'MIT',
    text: `Copyright (c) ${name}`,
    ...extra,
});

describe('packageDirOf', () => {
    it('finds the package a module of node_modules belongs to', () => {
        expect(packageDirOf('/repo/node_modules/clsx/dist/clsx.mjs')).toBe(
            '/repo/node_modules/clsx',
        );
    });

    it('keeps the scope of a scoped package', () => {
        expect(packageDirOf('/repo/node_modules/@floating-ui/dom/dist/floating-ui.dom.mjs')).toBe(
            '/repo/node_modules/@floating-ui/dom',
        );
    });

    it('takes the innermost package when one is nested in another', () => {
        expect(packageDirOf('/repo/node_modules/a/node_modules/b/index.js')).toBe(
            '/repo/node_modules/a/node_modules/b',
        );
    });

    it('reads through a virtual module prefix and a query', () => {
        expect(packageDirOf('\0/repo/node_modules/tslib/tslib.es6.mjs?commonjs-proxy')).toBe(
            '/repo/node_modules/tslib',
        );
    });

    it('ignores the SDK’s own source', () => {
        expect(packageDirOf('/repo/src/index.ts')).toBeUndefined();
    });
});

describe('installedPackageDir', () => {
    const existing =
        (...files: string[]) =>
        (path: string) =>
            files.includes(path);

    it('keeps a package that has its own package.json', () => {
        expect(
            installedPackageDir(
                '/repo/node_modules/clsx',
                existing('/repo/node_modules/clsx/package.json'),
            ),
        ).toBe('/repo/node_modules/clsx');
    });

    it('finds the installed copy of a dependency another package inlined', () => {
        expect(
            installedPackageDir(
                '/repo/node_modules/@solvimon/solvimon-ui/dist/node_modules/@vueuse/shared',
                existing('/repo/node_modules/@vueuse/shared/package.json'),
            ),
        ).toBe('/repo/node_modules/@vueuse/shared');
    });

    it('prefers the copy nearest to the package that inlined it', () => {
        expect(
            installedPackageDir(
                '/repo/node_modules/ui/dist/node_modules/clsx',
                existing(
                    '/repo/node_modules/ui/node_modules/clsx/package.json',
                    '/repo/node_modules/clsx/package.json',
                ),
            ),
        ).toBe('/repo/node_modules/ui/node_modules/clsx');
    });
});

describe('collectBundledPackages', () => {
    const read = (dir: string) => pkg(dir.replace(/^.*node_modules\//, ''));

    it('lists each package once, sorted by name', () => {
        const packages = collectBundledPackages(
            [
                '/repo/node_modules/clsx/dist/a.mjs',
                '/repo/node_modules/@vueuse/core/index.mjs',
                '/repo/node_modules/clsx/dist/b.mjs',
                '/repo/src/index.ts',
            ],
            read,
        );

        expect(packages.map(({ name }) => name)).toEqual(['@vueuse/core', 'clsx']);
    });

    it('leaves out Solvimon’s own packages, which this package’s license covers', () => {
        const packages = collectBundledPackages(
            ['/repo/node_modules/@solvimon/solvimon-ui/dist/index.mjs'],
            read,
        );

        expect(packages).toEqual([]);
    });
});

describe('licenseProblems', () => {
    it('accepts a permissive license with its text', () => {
        expect(licenseProblems([pkg('clsx')])).toEqual([]);
    });

    it('refuses a license outside the allowed ones', () => {
        expect(licenseProblems([pkg('copyleft', { license: 'GPL-3.0' })])).toEqual([
            'copyleft@1.0.0 is GPL-3.0, which is not allowed',
        ]);
    });

    it('refuses a package that declares no license', () => {
        expect(licenseProblems([pkg('unknown', { license: undefined })])).toEqual([
            'unknown@1.0.0 declares no license',
        ]);
    });

    it('refuses a package with no license text to reproduce', () => {
        expect(licenseProblems([pkg('bare', { text: undefined })])).toEqual([
            'bare@1.0.0 ships no license file to reproduce',
        ]);
    });
});

describe('renderThirdPartyLicenses', () => {
    it('reproduces each package’s license text under its name and version', () => {
        const rendered = renderThirdPartyLicenses([pkg('clsx')]);

        expect(rendered).toContain('## clsx 1.0.0\n\nLicense: MIT\n\n```\nCopyright (c) clsx\n```');
    });

    it('credits the source of the address formats', () => {
        expect(renderThirdPartyLicenses([])).toContain('libaddressinput');
    });
});
