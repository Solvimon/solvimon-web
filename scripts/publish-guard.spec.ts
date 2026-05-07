import { describe, it, expect } from 'vitest';
import { checkPublishAllowed } from './publish-guard.mjs';

describe('checkPublishAllowed', () => {
    it('passes when CI is set', () => {
        expect(checkPublishAllowed({ CI: 'true' })).toEqual({ ok: true });
    });

    it('fails when CI is not set', () => {
        const result = checkPublishAllowed({});
        expect(result.ok).toBe(false);
        expect(result.error).toContain('CI pipeline');
    });
});
