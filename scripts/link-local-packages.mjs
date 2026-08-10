#!/usr/bin/env node

/**
 * Links (or unlinks) the private Solvimon packages against a local `solvimon-desk`
 * checkout, so playground changes to those packages are picked up without publishing.
 *
 * Linking happens in the SDK root — not in `playground/`. The playground imports
 * `@solvimon/solvimon-web/core`, which vite aliases to `../src/public/core/index.ts`,
 * and those SDK sources resolve the packages from the SDK root's `node_modules`.
 *
 * Override the checkout location with SOLVIMON_DESK_PATH when it is not a sibling
 * of this repository.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESK_DIR = path.resolve(ROOT_DIR, process.env.SOLVIMON_DESK_PATH || '../solvimon-desk');

const PACKAGES = [
    { name: '@solvimon/solvimon-ui', directory: 'packages/ui' },
    { name: '@solvimon/solvimon-types', directory: 'packages/types' },
];

/**
 * Resolves a package directory in the desk checkout and asserts it really contains
 * the package we expect, so a mistyped SOLVIMON_DESK_PATH fails loudly instead of
 * linking something arbitrary.
 *
 * @param {{ name: string, directory: string }} pkg
 * @returns {string} absolute path to the package directory
 */
function resolvePackageDirectory(pkg) {
    const packageDirectory = path.resolve(DESK_DIR, pkg.directory);
    const manifestFile = path.join(packageDirectory, 'package.json');

    if (!fs.existsSync(manifestFile)) {
        throw new Error(
            `No package.json at ${manifestFile}.\n` +
                `Set SOLVIMON_DESK_PATH to your solvimon-desk checkout (currently "${DESK_DIR}").`,
        );
    }

    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));

    if (manifest.name !== pkg.name) {
        throw new Error(
            `Expected ${manifestFile} to be "${pkg.name}" but found "${manifest.name}".`,
        );
    }

    return packageDirectory;
}

function link() {
    const packageDirectories = PACKAGES.map((pkg) => {
        const packageDirectory = resolvePackageDirectory(pkg);
        console.log(`Linking ${pkg.name} -> ${packageDirectory}`);
        return packageDirectory;
    });

    // One npm call for both: `npm link` reifies the whole tree, so linking them one at a
    // time makes the second run replace the first link with the registry version again.
    execFileSync('npm', ['link', ...packageDirectories], { cwd: ROOT_DIR, stdio: 'inherit' });

    console.log(
        '\nLinked. @solvimon/solvimon-ui is consumed from its dist, so keep a build running:\n' +
            `  npm --prefix ${path.relative(ROOT_DIR, path.resolve(DESK_DIR, 'packages/ui'))} run watch\n` +
            'Then start the playground with `npm run playground:dev`.',
    );
}

function unlink() {
    for (const pkg of PACKAGES) {
        const installedPath = path.join(ROOT_DIR, 'node_modules', pkg.name);

        // lstat rather than existsSync: a symlink to a checkout that has since moved is
        // broken, and existsSync follows the link and would report it as absent.
        if (!fs.lstatSync(installedPath, { throwIfNoEntry: false })) {
            console.log(`${pkg.name} is not installed, skipping`);
            continue;
        }

        console.log(`Removing ${pkg.name}`);
        fs.rmSync(installedPath, { recursive: true, force: true });
    }

    // Restores the registry versions from the lockfile. `npm unlink` is an alias for
    // `npm uninstall` and would strip the packages from package.json, so avoid it.
    console.log('\nReinstalling from the lockfile...');
    execFileSync('npm', ['install'], { cwd: ROOT_DIR, stdio: 'inherit' });
}

const command = process.argv[2];

try {
    if (command === 'link') {
        link();
    } else if (command === 'unlink') {
        unlink();
    } else {
        console.error(`Usage: node scripts/link-local-packages.mjs <link|unlink>`);
        process.exit(1);
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
