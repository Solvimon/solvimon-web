import type { Invoice } from '@solvimon/types';

const invoice: Invoice = {
    id: 'invo_swDeeD0u13yu2JAhel1H',
    platform_id: 'plat_MwDeeN0teYT44uANeN10',
    customer: {
        object_type: 'CUSTOMER',
        id: 'cust_dwDeeN0teYZSfzALeN1b',
        created_at: '2024-01-11T12:17:21Z',
        reference: 'AmsterdamParking',
        status: 'ACTIVE',
        timezone: 'UTC',
        type: 'ORGANIZATION',
        email: 'AmsterdamParking@solvimon.com',
        organization: {
            legal_name: 'Amsterdam Parking B.V.',
            tax_id: 'tax',
            tax_exempt: false,
            registered_address: {
                line1: 'line 1',
                line2: 'line 2',
                city: 'Amsterdam',
                postal_code: '1234AB',
                state: 'Utrecht',
                country: 'NL',
            },
            registration_number: '1234',
            tax_exempt_note: 'tax'
        },
    },
    billing_entity: {
        object_type: 'BILLING_ENTITY',
        id: 'bile_dwDeeN0tjn7VCLAVeN1d',
        created_at: '2024-01-11T12:17:21Z',
        reference: 'Default-billing-entity',
        status: 'ACTIVE',
        timezone: 'UTC',
        legal_name: 'Test Parking Platform B.V.',
        tax_id: 'NL123456789B01',
        registered_address: {
            line1: 'Daalsesingel 51',
            line2: '',
            city: 'Utrecht',
            postal_code: '3511 SW',
            state: 'Utrecht',
            country: 'NL',
        },
        registration_number: '1234',
    },
    status: 'OPEN',
    on_hold: false,
    paid: false,
    type: 'STANDARD',
    created_at: '2024-01-11T12:22:29Z',
    updated_at: '2024-01-16T09:34:32Z',
    invoice_date: '2024-02-01T00:00:00Z',
    due_date: '2024-02-15T00:00:00Z',
    billing_currency: 'EUR',
    invoice_amount_including_tax: {
        quantity: '6745.75',
        currency: 'EUR',
    },
    open_invoice_amount: {
        quantity: '6745.75',
        currency: 'EUR',
    },
    timezone: 'UTC',
    billing_period: {
        type: 'MONTH',
        value: 1,
    },
    pricing_plan_subscription_ids: ['ppsu_JwDeeN0tivOj6XAWe91S'],
    tax_categories: [
        {
            base_amount: {
                quantity: '5575.00',
                currency: 'EUR',
            },
            tax_amount: {
                quantity: '1170.75',
                currency: 'EUR',
            },
            total_amount: {
                quantity: '6745.75',
                currency: 'EUR',
            },
            percentage: '21',
            name: 'BTW',
            category: 'STANDARD',
        },
    ],
    tax_summary: {
        base_amount: {
            quantity: '5575.00',
            currency: 'EUR',
        },
        tax_amount: {
            quantity: '1170.75',
            currency: 'EUR',
        },
        total_amount: {
            quantity: '6745.75',
            currency: 'EUR',
        },
        country_code: 'NL',
    },
    payment_acceptor_ids: ['paya_jwDeeN0tp8RcR9AleN19'],
    payment_actions: [
        {
            payment_acceptor_id: 'paya_jwDeeN0tp8RcR9AleN19',
            payment_acceptor: {
                id: "paya_jwDeeN0tp8RcR9AleN19",
                name: 'Payment acceptor',
                reference: 'payment_acceptor',
            },
            type: 'BANK_ACCOUNT',
            bank_account: {
                legal_name: 'Test Parking Platform B.V.',
                country_code: 'NL',
                iban: 'NL51INGB00000000',
                reference: '<unknown>',
            },
            name: 'action',
            reference: 'action',
            description: ''
        },
    ],
};

export default invoice;
