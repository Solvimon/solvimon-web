'use client';

import { createSolvimonCore } from '@solvimon/solvimon-web/core';
import { useEffect, useRef } from 'react';
import styles from './page.module.css';

const solvimon = createSolvimonCore({
    environment: 'TEST',
    locale: 'en-US',
    logLevel: 'info',
    branding: {
        colors: {
            primary: '#1d4ed8',
            secondary: '#0f172a',
        },
    },
});

export default function Home() {
    const paymentMethodFormContainer = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!paymentMethodFormContainer.current) {
            return;
        }

        const unmount = solvimon.createComponent('payment-method-form', {
            container: paymentMethodFormContainer.current,
            portalObject: {
                object_type: 'PORTAL_URL',
                id: 'purl_example',
                type: 'CUSTOMER',
                customer_id: 'cust_example',
                token: 'replace-with-a-real-portal-token',
                status: 'PUBLISHED',
            },
            configuration: {
                variant: 'TOKENIZE',
                successRedirectUrl: 'https://example.com/customer/payment-methods',
            },
        });

        return () => {
            unmount?.();
        };
    }, []);

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <p className={styles.eyebrow}>Published Package Demo</p>
                <h1 className={styles.title}>Solvimon Payment Method Form</h1>
                <p className={styles.copy}>
                    This example mounts the published SDK component through{' '}
                    <code>createSolvimonCore</code>.
                </p>
                <div ref={paymentMethodFormContainer} className={styles.sdkRoot} />
            </main>
        </div>
    );
}
