import { describe, it, expect } from 'vitest';
import { bundledUnscannedUiFiles } from './tailwind-content.mjs';

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

    it('does not take a directory for another whose name it starts', () => {
        const toastProvider = `${installed}/components/shared/ToastProvider/ToastProvider.vue.es.js`;

        expect(bundledUnscannedUiFiles([toastProvider])).toEqual([]);
    });

    it('reads Windows paths', () => {
        const windows =
            'C:\\app\\node_modules\\@solvimon\\solvimon-ui\\dist\\party-details\\x.es.js';

        expect(bundledUnscannedUiFiles([windows])).toEqual([windows]);
    });
});
