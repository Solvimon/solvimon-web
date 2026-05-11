import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

export function dirSize(path) {
    let total = 0;
    try {
        for (const entry of readdirSync(path, { withFileTypes: true })) {
            const full = join(path, entry.name);
            total += entry.isDirectory() ? dirSize(full) : statSync(full).size;
        }
    } catch {
        // directory doesn't exist
    }
    return total;
}

export function measureBundle(distDir = 'dist') {
    const entries = {};
    for (const section of ['screens', 'components']) {
        try {
            for (const name of readdirSync(join(distDir, section))) {
                entries[`${section}/${name}`] = dirSize(join(distDir, section, name));
            }
        } catch {
            // section doesn't exist
        }
    }
    return { total: dirSize(distDir), entries };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    console.log(JSON.stringify(measureBundle()));
}
