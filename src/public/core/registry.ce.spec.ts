import type { MockInstance } from 'vitest';
import { ensureCustomElementDefined } from './registry.ce';

const toKebabCase = (directory: string) =>
    directory.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

/** The ids each kind should register, derived from the `*.entry.ce.ts` files on disk. */
const idsOnDisk = (paths: string[]) =>
    paths.map((path) => toKebabCase(/\/(\w+)\/\w+\.entry\.ce\.ts$/.exec(path)![1])).sort();

const screenEntries = import.meta.glob('/src/public/screens/*/*.entry.ce.ts');
const componentEntries = import.meta.glob('/src/public/components/*/*.entry.ce.ts');
const screenIds = idsOnDisk(Object.keys(screenEntries));
const componentIds = idsOnDisk(Object.keys(componentEntries));

describe('ensureCustomElementDefined', () => {
    // Importing an entry defines nothing, so warming the module graph up front only keeps the
    // first cold transform of each entry from running into the per-test timeout.
    beforeAll(async () => {
        await Promise.all(
            [...Object.values(screenEntries), ...Object.values(componentEntries)].map((load) =>
                load(),
            ),
        );
    }, 60_000);

    it('finds an entry file for both kinds, so the checks below are not against nothing', () => {
        expect(screenIds.length).toBeGreaterThan(0);
        expect(componentIds.length).toBeGreaterThan(0);
    });

    describe.each([
        ['screen', screenIds],
        ['component', componentIds],
    ] as const)('for a %s', (type, ids) => {
        let defineSpy: MockInstance<CustomElementRegistry['define']>;

        beforeEach(() => {
            defineSpy = vi.spyOn(customElements, 'define');
        });

        afterEach(() => {
            defineSpy.mockRestore();
        });

        // Loads the real entries: a loader pointing at the wrong module defines the wrong tag.
        it.each(ids)('loads and defines only the element for "%s"', async (id) => {
            await ensureCustomElementDefined(id, type);

            expect(defineSpy.mock.calls.map(([tagName]) => tagName)).toStrictEqual([
                `solvimon-${id}`,
            ]);
            expect(customElements.get(`solvimon-${id}`)).toBeDefined();
        });

        it('does not define an element a second time', async () => {
            await ensureCustomElementDefined(ids[0], type);
            defineSpy.mockClear();

            await ensureCustomElementDefined(ids[0], type);
            expect(defineSpy).not.toHaveBeenCalled();
        });
    });

    it('throws at the call site for an unknown id instead of returning a rejected promise', () => {
        expect(() => ensureCustomElementDefined('does-not-exist', 'component')).toThrow(
            /unknown component id "does-not-exist"/,
        );
        expect(() => ensureCustomElementDefined('does-not-exist', 'screen')).toThrow(
            /unknown screen id "does-not-exist"/,
        );
    });

    it('rejects a component id asked for as a screen, and a screen id asked for as a component', () => {
        expect(() => ensureCustomElementDefined(componentIds[0], 'screen')).toThrow(
            `unknown screen id "${componentIds[0]}"`,
        );
        expect(() => ensureCustomElementDefined(screenIds[0], 'component')).toThrow(
            `unknown component id "${screenIds[0]}"`,
        );
    });

    it.each(['toString', 'constructor', '__proto__', 'hasOwnProperty'])(
        'treats the inherited property "%s" as an unknown id',
        (id) => {
            expect(() => ensureCustomElementDefined(id, 'screen')).toThrow(
                `unknown screen id "${id}"`,
            );
            expect(() => ensureCustomElementDefined(id, 'component')).toThrow(
                `unknown component id "${id}"`,
            );
        },
    );
});
