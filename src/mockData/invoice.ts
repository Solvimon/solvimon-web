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
    closed_invoice_amount: {
        quantity: '0.00',
        currency: 'EUR',
    },
    timezone: 'UTC',
    billing_period: {
        type: 'MONTH',
        value: 1,
    },
    pricing_plan_subscription_ids: ['ppsu_JwDeeN0tivOj6XAWe91S'],
    groups: [
        {
            group_order: 1,
            total: {
                quantity: '575.00',
                currency: 'EUR',
            },
            billing_period: {
                type: 'MONTH',
                value: -1,
            },
            start_date: '2024-01-11T12:17:21Z',
            end_date: '2024-02-01T00:00:00Z',
            type: 'PRICING',
            groups: [
                {
                    group_order: 1,
                    total: {
                        quantity: '575.00',
                        currency: 'EUR',
                    },
                    billing_period: {
                        type: 'MONTH',
                        value: -1,
                    },
                    start_date: '2024-01-11T12:17:21Z',
                    end_date: '2024-02-01T00:00:00Z',
                    type: 'PRICING',
                    product_category: {
                        object_type: 'PRODUCT_CATEGORY',
                        id: 'proc_CwDeeN0tg038edAjeN1e',
                        name: 'Parking Default',
                        reference: 'parking_default',
                        description: 'Default parking product',
                    },
                    products: [
                        {
                            object_type: 'PRODUCT',
                            id: 'prod_kwDeeN0tg038ejACeB1o',
                            category_id: 'proc_CwDeeN0tg038edAjeN1e',
                            name: 'ParkingProduct',
                            reference: 'parking_product',
                            description: 'This is the default parking product',
                            status: 'ACTIVE',
                            product_type: 'DEFAULT',
                        },
                    ],
                    lines: [
                        {
                            line_order: 1,
                            pricing_item_config_id: 'pico_XwDeeN0ttXxGUJALej16',
                            product_items: [
                                {
                                    object_type: 'PRODUCT_ITEM',
                                    id: 'proi_fwDeeN0tg65wlqAMeN19',
                                    product_id: 'prod_kwDeeN0tg038ejACeB1o',
                                    name: 'Recurring subscription',
                                    reference: 'recurring_subscription',
                                    description: 'Monthly subscription',
                                    type: 'REVENUE',
                                    charge_type: 'RECURRING',
                                    model_type: 'RECURRING',
                                },
                            ],
                            pricing_type: 'FIXED',
                            type: 'PRICING',
                            tax_categories: [
                                {
                                    base_amount: {
                                        quantity: '75.00',
                                        currency: 'EUR',
                                    },
                                    tax_amount: {
                                        quantity: '15.75',
                                        currency: 'EUR',
                                    },
                                    total_amount: {
                                        quantity: '90.75',
                                        currency: 'EUR',
                                    },
                                    percentage: '21',
                                    name: 'BTW',
                                    category: 'STANDARD',
                                },
                            ],
                            details: {
                                amount: {
                                    quantity: '75.00',
                                    currency: 'EUR',
                                },
                                pricing_currency: 'EUR',
                                pricing_amount: {
                                    quantity: '75.00',
                                    currency: 'EUR',
                                },
                                band: {
                                    amount: {
                                        quantity: '75',
                                        currency: 'EUR',
                                    },
                                },
                            },
                        },
                        {
                            line_order: 2,
                            pricing_item_config_id: 'pico_pwDeeN0ttXxGUKAleC17',
                            product_items: [
                                {
                                    object_type: 'PRODUCT_ITEM',
                                    id: 'proi_SwDeeN0tg65wlwAXeB1Z',
                                    product_id: 'prod_kwDeeN0tg038ejACeB1o',
                                    name: 'Support_subscription_fee',
                                    reference: 'support_subscription_fee',
                                    description: 'Recurring subscription fee for 24/7 support',
                                    type: 'REVENUE',
                                    charge_type: 'RECURRING',
                                    model_type: 'RECURRING',
                                },
                            ],
                            pricing_type: 'FIXED',
                            type: 'PRICING',
                            tax_categories: [
                                {
                                    base_amount: {
                                        quantity: '500.00',
                                        currency: 'EUR',
                                    },
                                    tax_amount: {
                                        quantity: '105.00',
                                        currency: 'EUR',
                                    },
                                    total_amount: {
                                        quantity: '605.00',
                                        currency: 'EUR',
                                    },
                                    percentage: '21',
                                    name: 'BTW',
                                    category: 'STANDARD',
                                },
                            ],
                            details: {
                                amount: {
                                    quantity: '500.00',
                                    currency: 'EUR',
                                },
                                pricing_currency: 'EUR',
                                pricing_amount: {
                                    quantity: '500.00',
                                    currency: 'EUR',
                                },
                                band: {
                                    amount: {
                                        quantity: '500',
                                        currency: 'EUR',
                                    },
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            group_order: 2,
            total: {
                quantity: '5000.00',
                currency: 'EUR',
            },
            billing_period: {
                type: 'MONTH',
                value: -1,
            },
            start_date: '2024-01-11T12:17:21Z',
            end_date: '2024-01-11T12:17:21Z',
            type: 'PRICING',
            groups: [
                {
                    group_order: 1,
                    total: {
                        quantity: '5000.00',
                        currency: 'EUR',
                    },
                    billing_period: {
                        type: 'MONTH',
                        value: -1,
                    },
                    start_date: '2024-01-11T12:17:21Z',
                    end_date: '2024-01-11T12:17:21Z',
                    type: 'PRICING',
                    product_category: {
                        object_type: 'PRODUCT_CATEGORY',
                        id: 'proc_CwDeeN0tg038edAjeN1e',
                        name: 'Parking Default',
                        reference: 'parking_default',
                        description: 'Default parking product',
                    },
                    products: [
                        {
                            object_type: 'PRODUCT',
                            id: 'prod_kwDeeN0tg038ejACeB1o',
                            category_id: 'proc_CwDeeN0tg038edAjeN1e',
                            name: 'ParkingProduct',
                            reference: 'parking_product',
                            description: 'This is the default parking product',
                            status: 'ACTIVE',
                            product_type: 'DEFAULT',
                        },
                    ],
                    lines: [
                        {
                            line_order: 1,
                            pricing_item_config_id: 'pico_qwDeeN0ttXxGUKAJeD1G',
                            product_items: [
                                {
                                    object_type: 'PRODUCT_ITEM',
                                    id: 'proi_MwDeeN0tg67HKOAOeB1a',
                                    product_id: 'prod_kwDeeN0tg038ejACeB1o',
                                    name: 'One-off installation fee',
                                    reference: 'one_off_installation_fee',
                                    description: 'One-off installation fee',
                                    type: 'REVENUE',
                                    charge_type: 'ONE_OFF',
                                    model_type: 'ONE_OFF',
                                },
                            ],
                            pricing_type: 'FLAT',
                            type: 'PRICING',
                            tax_categories: [
                                {
                                    base_amount: {
                                        quantity: '5000.00',
                                        currency: 'EUR',
                                    },
                                    tax_amount: {
                                        quantity: '1050.00',
                                        currency: 'EUR',
                                    },
                                    total_amount: {
                                        quantity: '6050.00',
                                        currency: 'EUR',
                                    },
                                    percentage: '21',
                                    name: 'BTW',
                                    category: 'STANDARD',
                                },
                            ],
                            details: {
                                amount: {
                                    quantity: '5000.00',
                                    currency: 'EUR',
                                },
                                pricing_currency: 'EUR',
                                pricing_amount: {
                                    quantity: '5000.00',
                                    currency: 'EUR',
                                },
                                band: {
                                    amount: {
                                        quantity: '5000',
                                        currency: 'EUR',
                                    },
                                },
                            },
                        },
                    ],
                },
            ],
        },
    ],
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
