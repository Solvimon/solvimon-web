import fs from 'fs';
import path from 'path';

/**
 * `target` with every symlink in it followed. Components that do not exist yet are appended as
 * they are; a dangling symlink throws, since writing through it would land wherever it points.
 *
 * @param {string} target - absolute path
 * @returns {string}
 */
function realpathOf(target) {
    const missing = [];
    let current = target;
    for (;;) {
        try {
            return path.join(fs.realpathSync(current), ...missing);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            if (isSymlink(current)) {
                throw new Error(`Dangling symlink: "${current}"`);
            }
            const parent = path.dirname(current);
            if (parent === current) return target;
            missing.unshift(path.basename(current));
            current = parent;
        }
    }
}

function isSymlink(target) {
    try {
        return fs.lstatSync(target).isSymbolicLink();
    } catch {
        return false;
    }
}

/**
 * Resolves `filePath` relative to `baseDir` and throws if the result escapes `baseDir`, directly or
 * through a symlink. Pass `null` or `undefined` to receive it back unchanged (convenient for
 * optional paths).
 *
 * @param {string | null | undefined} filePath
 * @param {string} baseDir - absolute path to the allowed root directory
 * @returns {string | null | undefined}
 */
export function resolveSafePath(filePath, baseDir) {
    if (!filePath) return filePath;
    const resolvedBase = path.resolve(baseDir);
    const resolved = path.resolve(resolvedBase, filePath);
    const isInside = (child, parent) => child.startsWith(parent + path.sep);
    // Checked as written and as the filesystem resolves it: a symlink inside the base can
    // point anywhere. The written form is returned, so callers can keep relating paths to it.
    if (
        !isInside(resolved, resolvedBase) ||
        !isInside(realpathOf(resolved), realpathOf(resolvedBase))
    ) {
        throw new Error(`Path traversal detected: "${filePath}" is outside "${baseDir}"`);
    }
    return resolved;
}

/**
 * `resolveSafePath` against each of `baseDirs` in turn, for a path that may sit in any of them.
 *
 * @param {string | null | undefined} filePath
 * @param {string[]} baseDirs
 * @returns {string | null | undefined}
 */
export function resolveSafePathIn(filePath, baseDirs) {
    if (!filePath) return filePath;
    for (const baseDir of baseDirs) {
        try {
            return resolveSafePath(filePath, baseDir);
        } catch {
            // Not inside this one; the next may hold it.
        }
    }
    throw new Error(`Path traversal detected: "${filePath}" is outside ${baseDirs.join(', ')}`);
}
