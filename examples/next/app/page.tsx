'use client'; // Ensure this file is treated as a client component

import { useEffect } from 'react';
import styles from './page.module.css';

export default function Home() {
    useEffect(() => {
        async function loadSolvimonSdk() {
            const { defineSolvimonAddPaymentMethodForm } = await import(
                '@solvimon/sdk/solvimon-add-payment-method-form'
            );
            defineSolvimonAddPaymentMethodForm();
        }

        void loadSolvimonSdk();
    }, []);

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                {/* @ts-ignore-next-line */}
                <solvimon-add-payment-method-form
                    token="S3JZMVgyZEVhZkduaFZkcWhLMncxRTZLa2NTQ0x3cDkucHVybF9td0RlZUEwdUhvc3ZWT0FSZTQxcg=="
                    environment="DEV"
                />
            </main>
        </div>
    );
}
