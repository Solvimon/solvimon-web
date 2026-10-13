import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';
import ts from 'typescript';
import { resolveSafePath } from './safe-path.mjs';

// Tests are named by what they test. Labels from the way a change was reviewed (a ticket, a
// tester, a review round) mean nothing to the next reader and go stale once the change merges.
const FILE_NAME = /(?:^|[.-])(?:tester|r\d+)(?=[.-])|(?:^|[.-])dd-?\d{3,}(?=[.-])/i;
const TITLE =
    /\btester\b|\bimplementer\b|^round \d+\b|\bround \d+:|tested independently|tried from outside|\bDD-\d+/i;
const COMMENT = /\btester\b|\bimplementer\b|\bDD-\d+/i;

const TEST_FUNCTIONS = new Set(['describe', 'it', 'test', 'suite']);

const rootOf = (expression) => {
    let node = expression;
    while (ts.isCallExpression(node) || ts.isPropertyAccessExpression(node)) {
        node = node.expression;
    }
    return ts.isIdentifier(node) ? node.text : undefined;
};

const titleOf = (argument) => {
    if (!argument) return undefined;
    if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
        return argument.text;
    }
    if (ts.isTemplateExpression(argument)) {
        return [
            argument.head.text,
            ...argument.templateSpans.map((span) => span.literal.text),
        ].join('…');
    }
    return undefined;
};

const lineOf = (source, position) => source.getLineAndCharacterOfPosition(position).line + 1;

/** @typedef {{ line: number, kind: 'file name' | 'title' | 'comment', text: string }} Label */

/** @param {string} file @returns {Label[]} */
export function findLabelsInFileName(file) {
    return FILE_NAME.test(path.basename(file)) ? [{ line: 0, kind: 'file name', text: file }] : [];
}

/** @param {string} file @param {string} content @returns {Label[]} */
export function findLabelsInSpec(file, content) {
    const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    /** @type {Label[]} */
    const found = [];

    const visit = (node) => {
        if (ts.isCallExpression(node) && TEST_FUNCTIONS.has(rootOf(node.expression))) {
            const title = titleOf(node.arguments[0]);
            if (title && TITLE.test(title)) {
                found.push({ line: lineOf(source, node.getStart()), kind: 'title', text: title });
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);

    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard);
    scanner.setText(content);
    for (
        let token = scanner.scan();
        token !== ts.SyntaxKind.EndOfFileToken;
        token = scanner.scan()
    ) {
        if (
            token !== ts.SyntaxKind.SingleLineCommentTrivia &&
            token !== ts.SyntaxKind.MultiLineCommentTrivia
        ) {
            continue;
        }
        const start = lineOf(source, scanner.getTokenStart());
        scanner
            .getTokenText()
            .split('\n')
            .forEach((text, offset) => {
                if (COMMENT.test(text)) {
                    found.push({ line: start + offset, kind: 'comment', text: text.trim() });
                }
            });
    }

    return found.sort((a, b) => a.line - b.line);
}

/**
 * @param {string[]} files
 * @param {(file: string) => string} readFile
 * @returns {(Label & { file: string })[]}
 */
export function checkFiles(files, readFile) {
    return files.flatMap((file) => [
        ...findLabelsInFileName(file).map((label) => ({ file, ...label })),
        ...findLabelsInSpec(file, readFile(file)).map((label) => ({ file, ...label })),
    ]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const given = process.argv.slice(2);
    const files = (
        given.length > 0
            ? given.map((file) => path.relative(rootDir, resolveSafePath(file, rootDir)))
            : await glob('{src,tests,scripts}/**/*.spec.ts', { cwd: rootDir, posix: true })
    ).filter((file) => /\.spec\.ts$/.test(file));

    const found = checkFiles(files, (file) => readFileSync(resolveSafePath(file, rootDir), 'utf8'));

    if (found.length > 0) {
        for (const { file, line, kind, text } of found) {
            console.error(`${line ? `${file}:${line}` : file}  ${kind}: ${text}`);
        }
        console.error(
            `\n${found.length} review label(s) in tests. Name tests by the behaviour they check, ` +
                'in the spec beside their source; see "Testing" in CLAUDE.md.',
        );
        process.exit(1);
    }
}
