'use client'; // Ensure this file is treated as a client component

import { useEffect } from 'react';
import styles from './page.module.css';

export default function Home() {
  useEffect(() => {
    async function loadSolvimonSdk() {
      const { defineSolvimonCheckout } = await import('@solvimon/sdk/solvimon-checkout');
      const { defineSolvimonInvoice } = await import('@solvimon/sdk/solvimon-invoice');
      defineSolvimonCheckout();
      defineSolvimonInvoice();
    }
    
    loadSolvimonSdk();
  }, []);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <solvimon-checkout />
        <solvimon-invoice />
      </main>
    </div>
  );
}