import { describe, it, expect } from 'vitest';
import { escapeRegExp, checkChangelog } from './check-changelog.mjs';

const VALID_CHANGELOG = `
## [1.2.3] - 2026-01-01

### Added

- Some new feature

## [1.2.2] - 2025-12-01

### Fixed

- Some bug fix
`.trim();

describe('escapeRegExp', () => {
    it('escapes special regex characters', () => {
        expect(escapeRegExp('1.2.3')).toBe('1\\.2\\.3');
        expect(escapeRegExp('1.0.0-alpha.1')).toBe('1\\.0\\.0-alpha\\.1');
        expect(escapeRegExp('a[b]c')).toBe('a\\[b\\]c');
    });

    it('leaves plain strings unchanged', () => {
        expect(escapeRegExp('abc')).toBe('abc');
    });
});

describe('checkChangelog', () => {
    it('passes when version heading and content are present', () => {
        const result = checkChangelog('1.2.3', VALID_CHANGELOG);
        expect(result).toEqual({ ok: true });
    });

    it('fails when version heading is missing', () => {
        const result = checkChangelog('9.9.9', VALID_CHANGELOG);
        expect(result.ok).toBe(false);
        expect(result.error).toContain('9.9.9');
    });

    it('fails when section body is empty', () => {
        const changelog = '## [1.2.3] - 2026-01-01\n\n## [1.2.2] - 2025-12-01\n\n- content';
        const result = checkChangelog('1.2.3', changelog);
        expect(result.ok).toBe(false);
        expect(result.error).toContain('must describe the release changes');
    });

    it('passes when section is the last entry with no following heading', () => {
        const changelog = '## [1.0.0] - 2026-01-01\n\n- Initial release';
        expect(checkChangelog('1.0.0', changelog)).toEqual({ ok: true });
    });

    it('passes when tag version matches package version', () => {
        const result = checkChangelog('1.2.3', VALID_CHANGELOG, { tagName: 'v1.2.3' });
        expect(result).toEqual({ ok: true });
    });

    it('fails when tag version does not match package version', () => {
        const result = checkChangelog('1.2.3', VALID_CHANGELOG, { tagName: 'v9.9.9' });
        expect(result.ok).toBe(false);
        expect(result.error).toContain('v9.9.9');
        expect(result.error).toContain('1.2.3');
    });

    it('skips tag check when tagName does not start with v', () => {
        const result = checkChangelog('1.2.3', VALID_CHANGELOG, { tagName: 'release-1.2.3' });
        expect(result).toEqual({ ok: true });
    });

    it('handles versions with special regex characters', () => {
        const changelog = '## [1.0.0-alpha.1] - 2026-01-01\n\n- Initial alpha';
        expect(checkChangelog('1.0.0-alpha.1', changelog)).toEqual({ ok: true });
    });
});
