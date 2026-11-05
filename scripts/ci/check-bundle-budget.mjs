import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { resolveSafePath } from '../safe-path.mjs';

/**
 * Fails the build when a screen or component outgrows its budget.
 *
 * `measure-bundle.mjs` reports, per entry, what a consumer downloads for it once bundled the way they
 * import it, in brotli bytes, shared chunks included. `bundle-budget.json` caps each one, so weight
 * added to every client has to raise a cap in the diff, where review sees it, rather than pass on a
 * report comment. `--update` raises only the caps that are exceeded or missing, and drops those of
 * entries that are gone, so one deliberate raise does not loosen every other cap with it.
 */

/** Room above today's size, so a small change does not have to touch the budget. */
export const HEADROOM = 0.05;

const BUDGET_PATH = join(dirname(fileURLToPath(import.meta.url)), 'bundle-budget.json');

/**
 * @param {{ entries: Record<string, { consumer?: { brotli?: number } | null }> }} sizes
 * @returns {Record<string, number>}
 */
const brotliByEntry = (sizes) =>
    Object.fromEntries(
        Object.entries(sizes.entries).map(([entry, { consumer }]) => [entry, consumer?.brotli]),
    );

/**
 * Why `sizes` does not fit `budget`: an entry over its cap, an entry with no cap, or a cap for an
 * entry that is gone.
 *
 * @param {{ entries: Record<string, { consumer?: { brotli?: number } | null }> }} sizes
 * @param {Record<string, number>} budget - brotli bytes per entry
 * @returns {string[]}
 */
export function budgetProblems(sizes, budget) {
    const measured = brotliByEntry(sizes);
    const problems = [];

    for (const [entry, brotli] of Object.entries(measured)) {
        if (!(entry in budget)) {
            problems.push(`${entry} has no budget; add it to bundle-budget.json`);
        } else if (!(brotli > 0)) {
            problems.push(`${entry} could not be measured`);
        } else if (brotli > budget[entry]) {
            problems.push(`${entry} is ${brotli} B brotli, over its budget of ${budget[entry]} B`);
        }
    }

    for (const entry of Object.keys(budget)) {
        if (!(entry in measured)) problems.push(`${entry} has a budget but is no longer built`);
    }

    return problems;
}

/** `HEADROOM` above `brotli`, rounded up to the next 100 bytes. */
const capFor = (brotli) => Math.ceil((brotli * (1 + HEADROOM)) / 100) * 100;

/**
 * `budget` with a cap for every measured entry that exceeds or lacks one, and without the entries
 * that are gone. Every other cap is kept as it is, and so is that of an entry not measured now.
 *
 * @param {{ entries: Record<string, { consumer?: { brotli?: number } | null }> }} sizes
 * @param {Record<string, number>} [budget]
 * @returns {Record<string, number>}
 */
export function updatedBudget(sizes, budget = {}) {
    return Object.fromEntries(
        Object.entries(brotliByEntry(sizes))
            .flatMap(([entry, brotli]) => {
                const current = budget[entry];
                if (!(brotli > 0)) return current === undefined ? [] : [[entry, current]];
                return [
                    [entry, current !== undefined && brotli <= current ? current : capFor(brotli)],
                ];
            })
            .sort(([a], [b]) => a.localeCompare(b)),
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const sizesPath = args.find((arg) => !arg.startsWith('--'));
    if (!sizesPath) {
        console.error('Usage: check-bundle-budget.mjs <bundle-sizes.json> [--update]');
        process.exit(2);
    }

    const sizes = JSON.parse(readFileSync(resolveSafePath(sizesPath, process.cwd()), 'utf-8'));
    const budget = existsSync(BUDGET_PATH) ? JSON.parse(readFileSync(BUDGET_PATH, 'utf-8')) : {};

    if (args.includes('--update')) {
        writeFileSync(BUDGET_PATH, `${JSON.stringify(updatedBudget(sizes, budget), null, 4)}\n`);
        console.log(`Wrote ${BUDGET_PATH}.`);
        process.exit(0);
    }

    const problems = budgetProblems(sizes, budget);

    if (problems.length > 0) {
        console.error(`Bundle budget exceeded:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
        console.error('Raise a budget on purpose with --update, and say why in the pull request.');
        process.exit(1);
    }

    console.log(
        `Every entry fits its budget (${Object.keys(brotliByEntry(sizes)).length} entries).`,
    );
}
