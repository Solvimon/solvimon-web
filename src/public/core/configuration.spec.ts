import { createSolvimonCore } from './configuration';
import type { ComponentMountConfiguration } from './types';

const { mockEnsureDefined } = vi.hoisted(() => ({ mockEnsureDefined: vi.fn() }));

/** These tests care where the element lands and what reaches it, not what the portal holds. */
const portalObject = {} as ComponentMountConfiguration<'invoices-list'>['portalObject'];

vi.mock('./registry.ce', async () => {
    const actual = await vi.importActual<typeof import('./registry.ce')>('./registry.ce');
    return {
        getCustomElementTagName: actual.getCustomElementTagName,
        ensureCustomElementDefined: mockEnsureDefined,
    };
});

/** Lets a test decide when the entry finishes loading. */
function deferred<T = void>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('createSolvimonCore', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'host';
        document.body.appendChild(container);
        mockEnsureDefined.mockReset();
        mockEnsureDefined.mockResolvedValue(undefined);
    });

    afterEach(() => {
        container.remove();
    });

    it('appends the element once its entry has loaded', async () => {
        const entry = deferred();
        mockEnsureDefined.mockReturnValueOnce(entry.promise);

        createSolvimonCore({ environment: 'TEST' }).createComponent('invoices-list', {
            container,
            portalObject,
        });

        // The entry is still in flight, so nothing has been put in the container yet.
        expect(container.children).toHaveLength(0);

        entry.resolve();
        await entry.promise;
        await Promise.resolve();

        expect(container.children).toHaveLength(1);
        expect(container.children[0].tagName.toLowerCase()).toBe('solvimon-invoices-list');
    });

    it('loads only the entry being mounted', async () => {
        createSolvimonCore().createComponent('invoices-list', {
            container,
            portalObject,
        });

        expect(mockEnsureDefined).toHaveBeenCalledTimes(1);
        expect(mockEnsureDefined).toHaveBeenCalledWith('invoices-list', 'component');
    });

    it('passes shared config and per-mount props to the element', async () => {
        createSolvimonCore({ environment: 'TEST', locale: 'nl-NL' }).createComponent(
            'invoices-list',
            { container, portalObject },
        );
        await Promise.resolve();
        await Promise.resolve();

        const element = container.children[0] as HTMLElement & Record<string, unknown>;
        expect(element.environment).toBe('TEST');
        expect(element.locale).toBe('nl-NL');
    });

    it('throws at the call site for an unknown container', () => {
        expect(() =>
            createSolvimonCore().createComponent('invoices-list', {
                container: '#nothing-here',
                portalObject,
            }),
        ).toThrow(/container not found/);
    });

    it('throws at the call site when the id is unknown, not inside a promise', () => {
        mockEnsureDefined.mockImplementationOnce(() => {
            throw new Error('Solvimon: unknown component id "nope".');
        });

        expect(() =>
            // @ts-expect-error - deliberately not a registered id
            createSolvimonCore().createComponent('nope', { container, portalObject }),
        ).toThrow(/unknown component id/);
    });

    it('cancels the mount when unmount is called before the entry lands', async () => {
        const entry = deferred();
        mockEnsureDefined.mockReturnValueOnce(entry.promise);

        const unmount = createSolvimonCore().createComponent('invoices-list', {
            container,
            portalObject,
        });

        unmount();
        entry.resolve();
        await entry.promise;
        await Promise.resolve();

        expect(container.children).toHaveLength(0);
    });

    it('removes the element when unmount is called after it has mounted', async () => {
        const unmount = createSolvimonCore().createComponent('invoices-list', {
            container,
            portalObject,
        });
        await Promise.resolve();
        await Promise.resolve();
        expect(container.children).toHaveLength(1);

        unmount();
        expect(container.children).toHaveLength(0);
    });

    it('reports a failed entry load through onLog', async () => {
        const onLog = vi.fn();
        const failure = new Error('chunk 404');
        mockEnsureDefined.mockReturnValueOnce(Promise.reject(failure));

        createSolvimonCore({ onLog }).createComponent('invoices-list', {
            container,
            portalObject,
        });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(onLog).toHaveBeenCalledWith(
            expect.objectContaining({
                level: 'error',
                code: 'INITIAL_DATA_LOAD_FAILED',
                error: failure,
                context: { id: 'invoices-list', type: 'component' },
            }),
        );
        expect(container.children).toHaveLength(0);
    });
});
