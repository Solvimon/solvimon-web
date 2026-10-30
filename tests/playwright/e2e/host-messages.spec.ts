import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import { customerOverview, hostEvents, mountCustomerOverview } from '../support/customerOverview';

/**
 * A host's own `messages`. The bundle parses every message of its own at build time and carries
 * no ICU parser, so these are the only messages that load one, when the element mounts.
 */

async function passMessages(page: Page, messages: Record<string, string>) {
    await page.addInitScript((passed: Record<string, string>) => {
        let config: unknown;
        Object.defineProperty(window, '__SOLVIMON_TEST_CONFIG__', {
            configurable: true,
            get: () => config,
            set: (value: object) => {
                config = { ...value, messages: passed };
            },
        });
    }, messages);
}

test.describe('Host messages', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test('shows a message the host passes in place of the default, arguments and all', async ({
        page,
    }) => {
        await passMessages(page, {
            'customer_overview.subscriptions_block.title':
                '{count, plural, one {Your plan} other {Your plans}}',
        });
        api = await mountCustomerOverview(page);

        await expect(customerOverview(page).subscriptions).toContainText('Your plan');
    });

    test('shows the default for a message that does not parse, and logs INVALID_MESSAGE', async ({
        page,
    }) => {
        await passMessages(page, {
            'customer_overview.subscriptions_block.title': '{count, plural, one {Your plan',
        });
        api = await mountCustomerOverview(page);

        await expect(customerOverview(page).subscriptions).toContainText('My subscription');
        const { logs } = await hostEvents(page);
        expect(logs.filter(({ code }) => code === 'INVALID_MESSAGE')).toHaveLength(1);
    });
});
