import type { CoreConfiguration, Environment as SdkEnvironment } from '@solvimon/solvimon-web/core';

/** Only what the switcher offers, which is also all `parseEnvironment` below ever returns. */
export type Environment = 'LIVE' | 'TEST' | 'DEV';

export const ENVIRONMENTS: Environment[] = ['LIVE', 'TEST', 'DEV'];

/**
 * Mirrors the first of the SDK's supported locales. Held as a literal rather than imported, because
 * that module is plain JS with no declarations and importing it costs a type error.
 */
export const DEFAULT_LOCALE = 'en-US';

export interface DevicePreset {
    id: string;
    label: string;
    width: number;
    height: number;
}

/** A handful of common shapes, in the spirit of the device list in browser devtools. */
export const DEVICE_PRESETS: DevicePreset[] = [
    { id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667 },
    { id: 'iphone-14-pro', label: 'iPhone 14 Pro', width: 393, height: 852 },
    { id: 'pixel-7', label: 'Pixel 7', width: 412, height: 915 },
    { id: 'ipad-mini', label: 'iPad mini', width: 768, height: 1024 },
    { id: 'ipad-pro', label: 'iPad Pro', width: 1024, height: 1366 },
];

/**
 * Either the entry mounted straight into the page, a named device, or whatever size the dimensions and
 * the drag handles have been left at.
 */
export type ViewportSelection = 'desktop' | 'responsive' | (string & {});

export interface ViewportSize {
    width: number;
    height: number;
}

/** Small enough to be worth previewing, and a floor the drag handles cannot go under. */
export const MIN_VIEWPORT_SIZE = 240;

/**
 * The mobile viewport previews the entry inside an iframe, because that is the only way the SDK sees a
 * narrow viewport: it reads `window.matchMedia`, and Tailwind's breakpoints are media queries too, so
 * both answer for the frame they are in rather than for the box they are drawn in.
 *
 * An iframe on the same origin shares session storage with the page that framed it, so these keys are
 * the handover between the two. Both sides read and write the same ones.
 */
const PREFIX = 'solvimon-playground';

export const STORAGE_KEYS = {
    locale: `${PREFIX}:locale`,
    environment: `${PREFIX}:environment`,
    activeEntry: `${PREFIX}:active-entry`,
    viewport: `${PREFIX}:viewport`,
    viewportSize: `${PREFIX}:viewport-size`,
} as const;

export const portalStorageKey = (entryId: string) => `${PREFIX}:portal:${entryId}`;

export const configStorageKey = (entryId: string) => `${PREFIX}:config:${entryId}`;

export interface PlaygroundMountConfig {
    container: Element;
    portalObject: Record<string, unknown>;
    configuration?: Record<string, unknown>;
}

/**
 * The slice of the SDK core the playground drives, and the point at which its type checking has to
 * stop: the real signatures narrow the id to the entries the SDK knows and the mount configuration to
 * that entry's own props, while the playground has a registry of plain strings and a portal object
 * pasted in as JSON. Declaring the seam keeps the method names and argument shapes checked, which is
 * what `any` here would give up.
 */
export interface PlaygroundCore {
    createScreen(id: string, configuration: PlaygroundMountConfig): () => void;
    createComponent(id: string, configuration: PlaygroundMountConfig): () => void;
}

export function asPlaygroundCore(core: CoreConfiguration): PlaygroundCore {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return core as unknown as PlaygroundCore;
}

/**
 * The playground runs against `npm run build:internal`, the only build in which DEV resolves. The
 * published `Environment` is `TEST | LIVE`, so handing the SDK an internal one needs a cast.
 */
export function asSdkEnvironment(environment: Environment): SdkEnvironment {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return environment as unknown as SdkEnvironment;
}

export const BRANDING = {
    colors: {
        primary: '#1d4ed8',
        secondary: '#0f172a',
    },
};

/** Where a fresh session starts once it leaves the desktop: a phone, under the SDK's 640px breakpoint. */
export const DEFAULT_VIEWPORT_SIZE: ViewportSize = { width: 393, height: 852 };

export function parseEnvironment(value: string | null): Environment {
    if (value === 'LIVE' || value === 'TEST' || value === 'DEV') {
        return value;
    }
    return 'TEST';
}

export function parseViewportSelection(value: string | null): ViewportSelection {
    if (!value) {
        return 'desktop';
    }

    if (value === 'responsive' || DEVICE_PRESETS.some((preset) => preset.id === value)) {
        return value;
    }

    return 'desktop';
}

export function findPreset(selection: ViewportSelection) {
    return DEVICE_PRESETS.find((preset) => preset.id === selection);
}

export function clampViewportSize(size: ViewportSize): ViewportSize {
    return {
        width: Math.max(MIN_VIEWPORT_SIZE, Math.round(size.width)),
        height: Math.max(MIN_VIEWPORT_SIZE, Math.round(size.height)),
    };
}

export function parseViewportSize(raw: string | null): ViewportSize {
    const parsed = parseJson(raw);
    const width = Number(parsed?.width);
    const height = Number(parsed?.height);

    if (!Number.isFinite(width) || !Number.isFinite(height)) {
        return DEFAULT_VIEWPORT_SIZE;
    }

    return clampViewportSize({ width, height });
}

export function parseJson(raw: string | null): Record<string, unknown> | null {
    if (!raw?.trim()) {
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/** The query the page frames itself with to render one entry on its own, free of the playground chrome. */
export const EMBED_QUERY_PARAM = 'embed';

export function isEmbedded(search = window.location.search) {
    return new URLSearchParams(search).has(EMBED_QUERY_PARAM);
}
