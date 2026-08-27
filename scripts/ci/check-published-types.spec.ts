import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import {
    ALLOWED_UNRESOLVABLE_TYPES,
    checkPublishedTypes,
    collectExternalTypes,
    packageNameOf,
    publicEntryPoints,
    resolvablePackages,
} from './check-published-types.mjs';

/** Stands in for this package's own manifest in the assertions below. */
const PACKAGE_JSON = {
    dependencies: { '@adyen/adyen-web': '^6.14.0' },
    peerDependencies: { vue: '>=3.5.0' },
};

const dirs: string[] = [];

afterEach(() => {
    dirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
    dirs.length = 0;
});

function tmpDist(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-published-types-'));
    dirs.push(dir);
    return dir;
}

function write(dist: string, relPath: string, contents: string): void {
    const file = path.join(dist, relPath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents, 'utf-8');
}

describe('packageNameOf', () => {
    it('reads the package out of a specifier, scope and subpath included', () => {
        expect(packageNameOf('vue')).toBe('vue');
        expect(packageNameOf('@solvimon/solvimon-ui')).toBe('@solvimon/solvimon-ui');
        expect(packageNameOf('@solvimon/solvimon-types/utils')).toBe('@solvimon/solvimon-types');
        expect(packageNameOf('lodash-es/merge')).toBe('lodash-es');
    });
});

describe('resolvablePackages', () => {
    it('is what the manifest promises a consumer will have', () => {
        expect(resolvablePackages(PACKAGE_JSON)).toEqual(new Set(['@adyen/adyen-web', 'vue']));
    });

    it('is empty for a manifest that promises nothing', () => {
        expect(resolvablePackages({})).toEqual(new Set());
    });
});

describe('publicEntryPoints', () => {
    it('lists the declarations package.json points a consumer at', () => {
        const dist = tmpDist();
        write(dist, 'index.d.ts', '');
        write(dist, 'core/index.d.ts', '');
        write(dist, 'core/action-request.types.d.ts', '');
        write(dist, 'components/InvoicesList/InvoicesList.ce.d.ts', '');
        write(dist, 'screens/Checkout/Checkout.ce.d.ts', '');

        expect(
            publicEntryPoints(dist)
                .map((file) => path.relative(dist, file))
                .sort(),
        ).toEqual([
            'components/InvoicesList/InvoicesList.ce.d.ts',
            'core/action-request.types.d.ts',
            'core/index.d.ts',
            'index.d.ts',
            'screens/Checkout/Checkout.ce.d.ts',
        ]);
    });

    it('skips entry points that were not emitted', () => {
        const dist = tmpDist();
        write(dist, 'index.d.ts', '');

        expect(publicEntryPoints(dist)).toHaveLength(1);
    });
});

describe('collectExternalTypes', () => {
    it('follows relative imports and collects the types they name', () => {
        const dist = tmpDist();
        write(dist, 'index.d.ts', "export * from './types/public/core/index';\n");
        write(
            dist,
            'types/public/core/index.d.ts',
            "export type { Mount } from '../mount.types';\n",
        );
        write(
            dist,
            'types/public/mount.types.d.ts',
            "import { Invoice } from '@solvimon/solvimon-types';\nexport type Mount = Invoice;\n",
        );

        const { imported, files } = collectExternalTypes(dist);

        expect(imported['@solvimon/solvimon-types']).toEqual(['Invoice']);
        expect(files).toHaveLength(3);
    });

    it('reads through a renamed import', () => {
        const dist = tmpDist();
        write(
            dist,
            'index.d.ts',
            "import { QuoteVersion as Quote } from '@solvimon/solvimon-types';\nexport type X = Quote;\n",
        );

        expect(collectExternalTypes(dist).imported['@solvimon/solvimon-types']).toEqual([
            'QuoteVersion',
        ]);
    });

    it('groups a subpath import under its package', () => {
        const dist = tmpDist();
        write(dist, 'index.d.ts', "import { Nullable } from '@solvimon/solvimon-types/utils';\n");

        expect(collectExternalTypes(dist).imported['@solvimon/solvimon-types']).toEqual([
            'Nullable',
        ]);
    });

    it('records packages a consumer can install too, so the caller decides', () => {
        const dist = tmpDist();
        write(dist, 'index.d.ts', "import { Ref } from 'vue';\nexport type X = Ref<string>;\n");

        expect(collectExternalTypes(dist).imported.vue).toEqual(['Ref']);
    });

    it('visits each declaration once when several entry points share it', () => {
        const dist = tmpDist();
        write(dist, 'index.d.ts', "export * from './shared';\n");
        write(dist, 'core/index.d.ts', "export * from '../shared';\n");
        write(dist, 'shared.d.ts', "import { Amount } from '@solvimon/solvimon-types';\n");

        expect(collectExternalTypes(dist).files).toHaveLength(3);
    });

    it('records a relative import that leads nowhere', () => {
        const dist = tmpDist();
        write(dist, 'index.d.ts', "export * from './types/vendor/index';\n");

        expect(collectExternalTypes(dist).dangling).toEqual(['index.d.ts -> ./types/vendor/index']);
    });

    it('does not follow a specifier that climbs out of dist', () => {
        const dist = tmpDist();
        write(dist, 'index.d.ts', "export * from '../../../etc/passwd';\n");

        expect(() => collectExternalTypes(dist)).toThrow(/Path traversal/);
    });
});

describe('checkPublishedTypes', () => {
    it('passes on a package the consumer installs alongside this one', () => {
        const dist = tmpDist();
        write(dist, 'index.d.ts', "import { ResultCode } from '@adyen/adyen-web';\n");

        expect(checkPublishedTypes(dist, PACKAGE_JSON).ok).toBe(true);
    });

    it('passes on a vendored type, which is reached relatively', () => {
        const dist = tmpDist();
        write(dist, 'index.d.ts', "export * from './types/vendor/index';\n");
        write(dist, 'types/vendor/index.d.ts', 'export interface Invoice { id: string }\n');

        expect(checkPublishedTypes(dist, PACKAGE_JSON).ok).toBe(true);
    });

    it('fails on a package the consumer has no way to install', () => {
        const dist = tmpDist();
        write(dist, 'index.d.ts', "import { Invoice } from '@solvimon/solvimon-types';\n");

        const { ok, unexpected } = checkPublishedTypes(dist, PACKAGE_JSON);

        expect(ok).toBe(false);
        expect(unexpected['@solvimon/solvimon-types']).toEqual(['Invoice']);
    });

    it('passes on an allowlisted type from a package the consumer cannot install', () => {
        const dist = tmpDist();
        write(dist, 'index.d.ts', "import { IntlMessages } from '@solvimon/solvimon-ui';\n");

        expect(checkPublishedTypes(dist, PACKAGE_JSON).ok).toBe(true);
    });

    it('fails on a type from that package the allowlist does not cover', () => {
        const dist = tmpDist();
        write(dist, 'index.d.ts', "import { ButtonProps } from '@solvimon/solvimon-ui';\n");

        const { ok, unexpected } = checkPublishedTypes(dist, PACKAGE_JSON);

        expect(ok).toBe(false);
        expect(unexpected['@solvimon/solvimon-ui']).toEqual(['ButtonProps']);
    });

    it('reports allowlist entries nothing reaches any more without failing', () => {
        const dist = tmpDist();
        write(dist, 'index.d.ts', "import { IntlMessages } from '@solvimon/solvimon-ui';\n");

        const { ok, stale } = checkPublishedTypes(dist, PACKAGE_JSON);

        expect(ok).toBe(true);
        expect(stale['@solvimon/solvimon-ui']).toEqual(['BrandProviderProps', 'IntlProviderProps']);
    });

    it('fails on an import the package does not contain', () => {
        // A declaration that was never emitted, or emitted somewhere the import does not point.
        const dist = tmpDist();
        write(dist, 'index.d.ts', "export * from './types/vendor/index';\n");

        const { ok, dangling } = checkPublishedTypes(dist, PACKAGE_JSON);

        expect(ok).toBe(false);
        expect(dangling).toEqual(['index.d.ts -> ./types/vendor/index']);
    });

    it('allowlists nothing a host writes', () => {
        // Those have to resolve, so they are vendored or declared — never waved through here.
        expect(Object.keys(ALLOWED_UNRESOLVABLE_TYPES)).toEqual(['@solvimon/solvimon-ui']);
        expect(ALLOWED_UNRESOLVABLE_TYPES['@solvimon/solvimon-ui']).not.toContain('ButtonProps');
    });
});
