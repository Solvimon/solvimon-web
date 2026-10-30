import { parseAst } from 'rollup/parseAst';
import { describe, it, expect } from 'vitest';
import {
    CATALOGUE_MODULE,
    UI_PARSER_MODULE,
    precompileCatalogueJson,
    precompileCatalogueModule,
    precompileDescriptors,
    toAst,
    unparsedDefaultMessages,
} from './precompile-messages.mjs';

const program = (code: string) => parseAst(code);
const precompile = (code: string) => precompileDescriptors(program(code), code);

describe('precompileDescriptors', () => {
    it('parses a literal defaultMessage and drops the description', () => {
        const code = `$t({ defaultMessage: "Hi {name}", id: "greeting", description: "A greeting" })`;

        expect(precompile(code)).toBe(
            `$t({ defaultMessage: ${JSON.stringify(toAst('Hi {name}'))}, id: "greeting" })`,
        );
    });

    it('drops a description that comes first, with its comma', () => {
        expect(precompile(`f({ description: "x", defaultMessage: "Hi", id: "a" })`)).toBe(
            `f({ defaultMessage: ${JSON.stringify(toAst('Hi'))}, id: "a" })`,
        );
    });

    it('reads a template literal without expressions', () => {
        expect(precompile('f({ defaultMessage: `Hi`, id: "a" })')).toBe(
            `f({ defaultMessage: ${JSON.stringify(toAst('Hi'))}, id: "a" })`,
        );
    });

    it('leaves a description that belongs to no message alone', () => {
        expect(precompile(`const product = { description: "Pro plan" }`)).toBeNull();
    });

    it('leaves a descriptor that passes its message on, as IntlProvider does', () => {
        expect(precompile(`format({ id, defaultMessage, description }, values)`)).toBeNull();
    });
});

describe('precompileCatalogueJson', () => {
    it('parses every message of a JSON catalogue', () => {
        expect(JSON.parse(precompileCatalogueJson('{"a": "Hi {name}"}'))).toEqual({
            a: toAst('Hi {name}'),
        });
    });
});

describe('precompileCatalogueModule', () => {
    it("parses the messages of solvimon-ui's compiled catalogue, not its keys", () => {
        const code = `const Bbc4Nn = "units";\nconst messages = { "a.b": "Hi", Bbc4Nn };\nexport { messages as default };`;

        expect(precompileCatalogueModule(program(code), code)).toBe(
            `const Bbc4Nn = ${JSON.stringify(toAst('units'))};\nconst messages = { "a.b": ${JSON.stringify(toAst('Hi'))}, Bbc4Nn };\nexport { messages as default };`,
        );
    });
});

describe('unparsedDefaultMessages', () => {
    it('finds a defaultMessage that is still a string', () => {
        expect(unparsedDefaultMessages('a({defaultMessage:"Hi",id:"x"})')).toEqual(['"Hi']);
    });

    it('passes a parsed one', () => {
        expect(unparsedDefaultMessages('a({defaultMessage:[{type:0,value:"Hi"}]})')).toEqual([]);
    });
});

describe('module patterns', () => {
    it('match the catalogues of the SDK and of solvimon-ui', () => {
        expect(CATALOGUE_MODULE.test('/app/src/translations/locales/nl-NL.json')).toBe(true);
        expect(CATALOGUE_MODULE.test('/ui/src/translations/de-DE.json')).toBe(true);
        expect(CATALOGUE_MODULE.test('/ui/dist/translations/en-US.json.es.js')).toBe(true);
        expect(CATALOGUE_MODULE.test('/app/src/translations/source.json')).toBe(false);
    });

    it("match solvimon-ui's bundled parser, not the SDK's own", () => {
        const ui = '/app/node_modules/@solvimon/solvimon-ui/dist/node_modules/@formatjs';
        expect(UI_PARSER_MODULE.test(`${ui}/icu-messageformat-parser/lib/parser.es.js`)).toBe(true);
        expect(
            UI_PARSER_MODULE.test(
                '/app/node_modules/@formatjs/icu-messageformat-parser/lib/parser.js',
            ),
        ).toBe(false);
    });
});
