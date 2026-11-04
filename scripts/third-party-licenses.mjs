/**
 * The licenses of the packages the build bundles into `dist`.
 *
 * The SDK declares no dependencies: everything it uses is bundled, so the license files that would
 * otherwise arrive with each installed dependency ship in `dist/THIRD_PARTY_LICENSES.md` instead.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Permissive licenses that only ask for their notice to travel with the code. */
export const ALLOWED_LICENSES = [
    'MIT',
    'ISC',
    'BSD-2-Clause',
    'BSD-3-Clause',
    '0BSD',
    'Apache-2.0',
];

/** Solvimon's own packages, covered by this package's license rather than listed as third party. */
const OWN_PACKAGE = /^@solvimon\//;

// Greedy, so a package nested in another's node_modules resolves to the inner one.
const PACKAGE_DIR = /^(.*\/node_modules\/(?:@[^/]+\/)?[^/]+)\//;
const LICENSE_FILE = /^(?:licen[cs]e|copying)(?:\.|$)/i;

/**
 * The directory of the installed package a module comes from, or `undefined` for the SDK's own
 * source and for virtual modules.
 *
 * @param {string} moduleId
 */
export function packageDirOf(moduleId) {
    return PACKAGE_DIR.exec(moduleId.replace(/^\0/, '').split('?')[0])?.[1];
}

/**
 * Where the package in `dir` is installed. A package that inlines its dependencies, as solvimon-ui
 * does under `dist/node_modules`, keeps no `package.json` for them, so the copy Node would resolve
 * from there stands in, the way it is found: up the tree, one `node_modules` at a time.
 *
 * @param {string} dir
 * @param {(path: string) => boolean} [exists]
 */
export function installedPackageDir(dir, exists = existsSync) {
    if (exists(join(dir, 'package.json'))) return dir;

    const [, from, name] = /^(.*)\/node_modules\/((?:@[^/]+\/)?[^/]+)$/.exec(dir) ?? [];
    for (let parent = from; parent && parent !== dirname(parent); parent = dirname(parent)) {
        const candidate = join(parent, 'node_modules', name);
        if (candidate !== dir && exists(join(candidate, 'package.json'))) return candidate;
    }

    return dir;
}

/**
 * Packages whose npm release leaves out the license file that a sibling from the same repository
 * ships, mapped to that sibling. `@vuelidate/validators` carries the vuelidate repository's LICENSE.
 *
 * @type {Record<string, string>}
 */
const LICENSE_TEXT_FROM = { '@vuelidate/core': '@vuelidate/validators' };

/** @param {string} dir */
function readLicenseText(dir) {
    if (!existsSync(dir)) return undefined;
    const licenseFile = readdirSync(dir).find((name) => LICENSE_FILE.test(name));
    return licenseFile ? readFileSync(join(dir, licenseFile), 'utf8').trim() : undefined;
}

/**
 * @typedef {{ name: string, version: string, license?: string, text?: string }} BundledPackage
 */

/**
 * @param {string} packageDir - a package's directory
 * @returns {BundledPackage}
 */
export function readBundledPackage(packageDir) {
    const dir = installedPackageDir(packageDir);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const source = LICENSE_TEXT_FROM[pkg.name];

    return {
        name: pkg.name,
        version: pkg.version,
        license: typeof pkg.license === 'string' ? pkg.license : undefined,
        text:
            readLicenseText(dir) ??
            (source && readLicenseText(installedPackageDir(join(dir, '..', '..', source)))),
    };
}

/**
 * The third-party packages among `moduleIds`, once each and sorted by name.
 *
 * @param {Iterable<string>} moduleIds
 * @param {(dir: string) => BundledPackage} read
 * @returns {BundledPackage[]}
 */
export function collectBundledPackages(moduleIds, read = readBundledPackage) {
    const dirs = new Set([...moduleIds].map(packageDirOf).filter(Boolean));
    const byKey = new Map();

    for (const dir of dirs) {
        const pkg = read(dir);
        if (!OWN_PACKAGE.test(pkg.name)) byKey.set(`${pkg.name}@${pkg.version}`, pkg);
    }

    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Why `packages` cannot be shipped as they are: a license outside `ALLOWED_LICENSES`, or no
 * license text to reproduce.
 *
 * @param {BundledPackage[]} packages
 * @returns {string[]}
 */
export function licenseProblems(packages) {
    return packages.flatMap(({ name, version, license, text }) => {
        const id = `${name}@${version}`;
        if (!license) return [`${id} declares no license`];
        if (!ALLOWED_LICENSES.includes(license))
            return [`${id} is ${license}, which is not allowed`];
        if (!text) return [`${id} ships no license file to reproduce`];
        return [];
    });
}

/**
 * @param {BundledPackage[]} packages
 * @returns {string}
 */
export function renderThirdPartyLicenses(packages) {
    const sections = packages.map(
        ({ name, version, license, text }) =>
            `## ${name} ${version}\n\nLicense: ${license}\n\n\`\`\`\n${text}\n\`\`\``,
    );

    return (
        [
            '# Third-party licenses',
            '`@solvimon/solvimon-web` bundles the packages below. Their licenses are reproduced as they ship them.',
            ...sections,
            '## Address formats',
            // shortcut: credits the source only; the data's own terms are still to be confirmed (DD-3697).
            "The address formats the checkout uses for each country are derived from the address metadata of Google's libaddressinput (https://github.com/google/libaddressinput), as served at https://chromium-i18n.appspot.com/ssl-address/data.",
        ].join('\n\n') + '\n'
    );
}
