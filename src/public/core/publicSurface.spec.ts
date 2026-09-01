import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Four places describe what this package makes public, and nothing kept them in step: the registry
 * mounted six screens where the barrel exported five and the README documented three, and
 * `invoice` had a subpath a consumer could import but no entry in the barrel at all.
 *
 * The registry is the source of truth, because it is what `createSolvimonCore` can actually mount —
 * whatever is in it is reachable, and so public, whether or not anyone wrote it down. The other
 * three are checked against it.
 *
 * Every file is read as text rather than imported: importing the registry pulls in all eighteen
 * entry components, and this needs to compare lists, not mount anything.
 */
// Vitest sets its root to the repository root, so these resolve from there. The "is not empty"
// assertion below is what catches a read that silently returns the wrong thing.
const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf-8');

const registry = read('src/public/core/registry.ts');
const packageJson = JSON.parse(read('package.json')) as { exports: Record<string, unknown> };
const barrel = read('src/index.ts');
const readme = read('README.md');

/** `payment-methods-management` -> `PaymentMethodsManagement`, the directory each entry lives in. */
const toPascalCase = (id: string) =>
    id
        .split('-')
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join('');

const registeredIds = (constantName: string) => {
    const declaration = new RegExp(`const ${constantName} = \\[([^\\]]*)\\]`).exec(registry);
    if (!declaration) throw new Error(`${constantName} not found in registry.ts`);
    return [...declaration[1].matchAll(/'([a-z-]+)'/g)].map((match) => match[1]).sort();
};

const subpaths = (prefix: string) =>
    Object.keys(packageJson.exports)
        .filter((key) => key.startsWith(`${prefix}/`))
        .map((key) => key.slice(prefix.length + 1))
        .sort();

const barrelEntries = (kind: 'screens' | 'components') =>
    [...barrel.matchAll(new RegExp(`public/${kind}/(\\w+)/`, 'g'))].map((match) => match[1]).sort();

const readmeRows = (kind: 'screens' | 'components') =>
    [...readme.matchAll(new RegExp(`@solvimon/solvimon-web/${kind}/([a-z-]+)\`\\s*\\|`, 'g'))]
        .map((match) => match[1])
        .sort();

describe.each([
    ['screens', 'REGISTERED_SCREEN_IDS'],
    ['components', 'REGISTERED_COMPONENT_IDS'],
] as const)('the public %s surface', (kind, constantName) => {
    const expected = registeredIds(constantName);

    it('is not empty, so a broken read cannot pass these by comparing nothing', () => {
        expect(expected.length).toBeGreaterThan(0);
    });

    it('has one package subpath per registered id', () => {
        expect(subpaths(`./${kind}`)).toStrictEqual(expected);
    });

    it('is re-exported from the root barrel', () => {
        expect(barrelEntries(kind)).toStrictEqual([...expected].map(toPascalCase).sort());
    });

    it('is documented in the README table', () => {
        expect(readmeRows(kind)).toStrictEqual(expected);
    });
});
