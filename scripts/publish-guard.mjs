import { fileURLToPath } from 'node:url';

export function checkPublishAllowed(env) {
    if (!env.CI) {
        return {
            ok: false,
            error: 'Publishing @solvimon/solvimon-web is only allowed from the CI pipeline',
        };
    }
    return { ok: true };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const result = checkPublishAllowed(process.env);
    if (!result.ok) {
        console.error(result.error);
        process.exit(1);
    }
}
