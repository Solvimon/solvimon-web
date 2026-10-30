import { getMissingFormFields } from './checkoutSessionForm';

describe('getMissingFormFields', () => {
    it('maps each customer path to the form fields of that customer', () => {
        expect(
            getMissingFormFields(
                [
                    'checkout_session.customers.0.customer.organization.registered_address.country',
                    'checkout_session.customers.0.customer.organization.legal_name',
                    'checkout_session.customers.1.customer.email',
                    'checkout_session.customers.1.customer.individual.residential_address.postal_code',
                    'checkout_session.customers.1.customer.individual.name',
                ],
                2,
            ),
        ).toStrictEqual([
            ['country', 'companyLegalName'],
            ['email', 'postalCode', 'firstName', 'lastName'],
        ]);
    });

    it('leaves out paths the form has no field for, and customers the session does not have', () => {
        expect(
            getMissingFormFields(
                [
                    'checkout_session.customers.0.customer.organization.registration_number',
                    'checkout_session.customers.0',
                    'checkout_session.pricing_plan_subscriptions.0.pricing_plan_subscription',
                    'checkout_session.customers.3.customer.email',
                ],
                1,
            ),
        ).toStrictEqual([[]]);
    });
});
