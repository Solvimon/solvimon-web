import path from 'path';

/**
 * Resolves `filePath` relative to `baseDir` and throws if the result escapes `baseDir`.
 * Pass `null` or `undefined` to receive it back unchanged (convenient for optional paths).
 *
 * @param {string | null | undefined} filePath
 * @param {string} baseDir - absolute path to the allowed root directory
 * @returns {string | null | undefined}
 */
export function resolveSafePath(filePath, baseDir) {
    if (!filePath) return filePath;
    const resolvedBase = path.resolve(baseDir);
    const resolved = path.resolve(resolvedBase, filePath);
    if (!resolved.startsWith(resolvedBase + path.sep)) {
        throw new Error(`Path traversal detected: "${filePath}" is outside "${baseDir}"`);
    }
    return resolved;
}
