import { test, expect, Page } from '@playwright/test';

const TEST_EMAIL = 'test@solvimon.com';
const TEST_COUNTRY = 'NL';

test.describe('SolvimonCheckout', () => {
    test('should prefill the email address when the email address is provided as an attribute', async ({
        page,
    }) => {
        await setup(page);

        const emailInput = page.locator('input[name="email"]');
        await expect(emailInput).toHaveValue(TEST_EMAIL);

        const countrySelect = page.locator('input[name="country"]');
        await expect(countrySelect).toHaveAttribute('placeholder', 'Netherlands');
    });

    test.describe('credit card payment', () => {
        const CREDIT_CARD_NUMBER = '4242 4242 4242 4242';
        const EXPIRY_DATE = '03/30';
        const CVC = '737';
        const NAME_ON_CARD = 'John Doe';

        test('should be successful with regular flow', async ({ page }) => {
            await setup(page);

            const paymentMethod = page
                .locator('.adyen-checkout__payment-method')
                .filter({ hasText: 'Cards' });
            await expect(paymentMethod).toBeVisible();
            await paymentMethod.click();

            await fillCreditCardDetails({
                page,
                cardNumber: CREDIT_CARD_NUMBER,
                expiryDate: EXPIRY_DATE,
                cvc: CVC,
                nameOnCard: NAME_ON_CARD,
            });

            // Submit form
            await page.getByRole('button', { name: /start trial/i }).click();

            // Wait for success message
            await page.waitForSelector('text=Payment successful');

            // Wait for redirect
            await page.waitForURL('https://www.solvimon.com');
        });

        test.describe('3d secure flow', () => {
            const CREDIT_CARD_NUMBER = '3714 4963 5398 431';
            const EXPIRY_DATE = '03/30';
            const CVC = '7373';
            const NAME_ON_CARD = 'John Doe';

            test('should be successful with 3d secure flow', async ({ page }) => {
                await setup(page);

                const paymentMethod = page
                    .locator('.adyen-checkout__payment-method')
                    .filter({ hasText: 'Cards' });
                await expect(paymentMethod).toBeVisible();
                await paymentMethod.click();

                await fillCreditCardDetails({
                    page,
                    cardNumber: CREDIT_CARD_NUMBER,
                    expiryDate: EXPIRY_DATE,
                    cvc: CVC,
                    nameOnCard: NAME_ON_CARD,
                });

                // Submit form
                await page.getByRole('button', { name: /start trial/i }).click();

                // Fill 3d secure form
                const frame = page.frameLocator('iframe[title="components iframe"]');
                const passwordInput = await frame.locator('input[name="answer"]');
                await passwordInput.fill('password');
                await frame.getByRole('button', { name: /continue/i }).click();

                // Wait for success message
                await page.waitForSelector('text=Payment successful');
            });

            test('should fail with 3d secure cancel flow', async ({ page }) => {
                await setup(page);

                const paymentMethod = page
                    .locator('.adyen-checkout__payment-method')
                    .filter({ hasText: 'Cards' });
                await expect(paymentMethod).toBeVisible();
                await paymentMethod.click();

                await fillCreditCardDetails({
                    page,
                    cardNumber: CREDIT_CARD_NUMBER,
                    expiryDate: EXPIRY_DATE,
                    cvc: CVC,
                    nameOnCard: NAME_ON_CARD,
                });

                // Submit form
                await page.getByRole('button', { name: /start trial/i }).click();

                // Fill 3d secure form
                const frame = page.frameLocator('iframe[title="components iframe"]');
                const passwordInput = await frame.locator('input[name="answer"]');
                await passwordInput.fill('password');
                await frame.getByRole('button', { name: /cancel/i }).click();

                // Expect to see checkout in initial state
                await page.waitForSelector('text=Solvimon Checkout Test App');
            });
        });
    });
});

const setup = async (page: Page) => {
    await page.goto(`/?email=${TEST_EMAIL}&country=${TEST_COUNTRY}`);
};

const fillCreditCardDetails = async ({
    page,
    cardNumber,
    expiryDate,
    cvc,
    nameOnCard,
}: {
    page: Page;
    cardNumber: string;
    expiryDate: string;
    cvc: string;
    nameOnCard: string;
}) => {
    // Credit card number
    const creditCardInputFrame = page.frameLocator('iframe[title="Iframe for card number"]');
    const creditCardInput = await creditCardInputFrame.locator(
        'input[data-fieldtype="encryptedCardNumber"]',
    );
    await creditCardInput.waitFor({ state: 'visible' });
    await creditCardInput.fill(cardNumber);

    // Expiry date
    const expiryDateInputFrame = page.frameLocator('iframe[title="Iframe for expiry date"]');
    const expiryDateInput = await expiryDateInputFrame.locator(
        'input[data-fieldtype="encryptedExpiryDate"]',
    );
    await expiryDateInput.waitFor({ state: 'visible' });
    await expiryDateInput.fill(expiryDate);

    // CVC
    const cvcIframe = page.frameLocator('iframe[title="Iframe for security code"]');
    const cvcInput = await cvcIframe.locator('input[data-fieldtype="encryptedSecurityCode"]');
    await cvcInput.waitFor({ state: 'visible' });
    await cvcInput.fill(cvc);

    // Name on card
    const nameOnCardInput = page.locator('input[name="holderName"]');
    await nameOnCardInput.waitFor({ state: 'visible' });
    await nameOnCardInput.fill(nameOnCard);
};
