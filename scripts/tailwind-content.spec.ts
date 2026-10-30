import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
    bundledUnscannedUiFiles,
    missingUiDirs,
    UI_DIRS_NOT_SCANNED,
} from './tailwind-content.mjs';

const installed = '/app/node_modules/@solvimon/solvimon-ui/dist';

describe('bundledUnscannedUiFiles', () => {
    it('returns the bundled files that sit in a directory Tailwind does not scan', () => {
        const editor = `${installed}/components/shared/Editor/EditorComponent.vue.es.js`;
        const button = `${installed}/components/shared/Button/Button.vue.es.js`;

        expect(bundledUnscannedUiFiles([editor, button])).toEqual([editor]);
    });

    it('checks a solvimon-ui linked from a local checkout, whose ids are its real path', () => {
        const linked =
            '/work/solvimon-desk/packages/ui/dist/components/pdf/StatusOverlay/X.vue.es.js';

        expect(bundledUnscannedUiFiles([linked])).toEqual([linked]);
    });

    it('does not match a directory that only shares a name prefix', () => {
        const toastProvider = `${installed}/components/shared/ToastProvider/ToastProvider.vue.es.js`;

        expect(bundledUnscannedUiFiles([toastProvider])).toEqual([]);
    });

    it('reads Windows paths', () => {
        const windows =
            'C:\\app\\node_modules\\@solvimon\\solvimon-ui\\dist\\party-details\\x.es.js';

        expect(bundledUnscannedUiFiles([windows])).toEqual([windows]);
    });
});

describe('missingUiDirs', () => {
    it('returns the listed directories solvimon-ui does not have', () => {
        const uiDist = mkdtempSync(join(tmpdir(), 'ui-dist-'));
        const [renamed, ...present] = UI_DIRS_NOT_SCANNED;
        present.forEach((dir) => mkdirSync(join(uiDist, dir), { recursive: true }));

        try {
            expect(missingUiDirs(uiDist)).toEqual([renamed]);
        } finally {
            rmSync(uiDist, { recursive: true, force: true });
        }
    });
});
