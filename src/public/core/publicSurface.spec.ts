import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getRegisteredComponentIds, getRegisteredScreenIds } from './registry';

/**
 * Four places describe what this package makes public, and nothing kept them in step: the registry
 * mounted six screens where the barrel exported five and the README documented three, and
 * `invoice` had a subpath a consumer could import but no entry in the barrel at all.
 *
 * The registry is the source of truth, because it is what `createSolvimonCore` can actually mount —
 * whatever is in it is reachable, and so public, whether or not anyone wrote it down. The other
 * three are checked against it.
 *
 * The other files are read as text rather than imported: this needs to compare lists, not load
 * every entry.
 */
// Vitest sets its root to the repository root, so these resolve from there. The "is not empty"
// assertion below is what catches a read that silently returns the wrong thing.
const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf-8');

const packageJson = JSON.parse(read('package.json')) as { exports: Record<string, unknown> };
const barrel = read('src/index.ts');
const readme = read('README.md');

/** `payment-methods-management` -> `PaymentMethodsManagement`, the directory each entry lives in. */
const toPascalCase = (id: string) =>
    id
        .split('-')
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join('');

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
    ['screens', getRegisteredScreenIds],
    ['components', getRegisteredComponentIds],
] as const)('the public %s surface', (kind, registeredIds) => {
    const expected: string[] = registeredIds().sort();

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
