import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import { customerOverview, hostEvents, mountCustomerOverview } from '../support/customerOverview';
import { aCustomerPortalObject, type Json } from '../support/fixtures';

/**
 * What a host is told when an element fails. The tests that build an element by hand do what a
 * plain HTML integration does: create it, listen on it, and set its properties themselves.
 */

const TAG = 'solvimon-customer-overview';

interface Recorded {
    /** Each `log` event's detail, which is the log entry. */
    logs: unknown[];
    errors: { isError: boolean; message: string; detailLength: number }[];
}

/** Appends a second element, built by hand with listeners of its own, then sets its properties. */
function appendElement(page: Page, properties: Record<string, unknown>): Promise<void> {
    return page.evaluate(
        ({ tag, properties }) => {
            const recorded: Recorded = { logs: [], errors: [] };
            Object.assign(window, { __HAND_BUILT__: recorded });

            const element = document.createElement(tag);
            element.id = 'hand-built';
            element.addEventListener('log', (event) => {
                recorded.logs.push('detail' in event ? event.detail : undefined);
            });
            element.addEventListener('error', (event) => {
                const detail = 'detail' in event ? event.detail : undefined;
                const [error] = Array.isArray(detail) ? detail : [];
                recorded.errors.push({
                    isError: error instanceof Error,
                    message: error instanceof Error ? error.message : String(error),
                    detailLength: Array.isArray(detail) ? detail.length : -1,
                });
            });

            document.body.append(element);
            Object.assign(element, properties);
        },
        { tag: TAG, properties },
    );
}

function setProperties(page: Page, properties: Record<string, unknown>): Promise<void> {
    return page.evaluate((properties) => {
        const element = document.getElementById('hand-built');
        if (element) Object.assign(element, properties);
    }, properties);
}

function handBuiltEvents(page: Page): Promise<Recorded> {
    return page.evaluate((): Recorded => Reflect.get(window, '__HAND_BUILT__'));
}

test.describe('Error reporting', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test('a failure inside an element reaches the host as an error event and a log entry', async ({
        page,
    }) => {
        api = await mountCustomerOverview(page, { environment: 'STAGING' });

        await expect
            .poll(async () => (await hostEvents(page)).errors)
            .toEqual([expect.stringContaining('Unknown Solvimon environment "STAGING"')]);
        expect((await hostEvents(page)).logs).toContainEqual(
            expect.objectContaining({ level: 'error', code: 'UNHANDLED_ERROR' }),
        );
        await expect(customerOverview(page).screen).toHaveCount(0);
    });

    test('a listener on the element receives the Error itself, without the portal token', async ({
        page,
    }) => {
        api = await mountCustomerOverview(page);
        await expect(customerOverview(page).billingInformation).toBeVisible();
        const portalObject: Json = aCustomerPortalObject();

        await appendElement(page, { environment: 'STAGING', locale: 'en-US', portalObject });

        await expect.poll(async () => (await handBuiltEvents(page)).errors).toHaveLength(1);
        const [received] = (await handBuiltEvents(page)).errors;
        expect(received).toMatchObject({ isError: true, detailLength: 1 });
        expect(received.message).toContain('Unknown Solvimon environment "STAGING"');
        expect(received.message).not.toContain(String(portalObject.token));
    });

    test('an element given its properties late waits for them instead of failing for good', async ({
        page,
    }) => {
        api = await mountCustomerOverview(page);
        await expect(customerOverview(page).billingInformation).toBeVisible();

        // Appended bare, the way markup is upgraded before a script has set anything on it.
        await appendElement(page, {});

        await expect
            .poll(async () => (await handBuiltEvents(page)).logs)
            .toContainEqual(
                expect.objectContaining({
                    level: 'warn',
                    code: 'MISSING_REQUIRED_PROPERTIES',
                    context: expect.objectContaining({ missing: ['environment', 'portalObject'] }),
                }),
            );

        await setProperties(page, {
            environment: 'TEST',
            locale: 'en-US',
            portalObject: aCustomerPortalObject(),
        });

        await expect(
            page.locator('#hand-built .sv-customer-overview__billing-information'),
        ).toBeVisible();
        expect((await handBuiltEvents(page)).errors).toEqual([]);
    });
});
