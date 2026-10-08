import { getChangelogSection } from '../check-changelog.mjs';

const CHANGELOG = `
## [1.2.3] - 2026-01-01

### Added

- Some new feature

## [1.2.2] - 2025-12-01

### Fixed

- Some bug fix
`.trim();

describe('getChangelogSection', () => {
    it('reads the section of the version being released', () => {
        expect(getChangelogSection('1.2.3', CHANGELOG)).toBe('### Added\n\n- Some new feature');
    });

    it('stops at the next release', () => {
        expect(getChangelogSection('1.2.2', CHANGELOG)).toBe('### Fixed\n\n- Some bug fix');
    });

    // The workflow's own awk only matched `## [version]`, so these released with an empty body.
    it('reads a heading written without brackets, which the gate also accepts', () => {
        expect(getChangelogSection('1.2.3', '## 1.2.3 - 2026-01-01\n\n- Plain heading')).toBe(
            '- Plain heading',
        );
    });

    it('does not read the prerelease section for the release it drops the tag to', () => {
        expect(getChangelogSection('0.1.0', '## [0.1.0-alpha.25]\n\n- Still in alpha')).toBe('');
    });

    it('returns nothing for a version with no section at all', () => {
        expect(getChangelogSection('9.9.9', CHANGELOG)).toBe('');
    });
});
