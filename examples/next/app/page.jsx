import Image from "next/image";
import styles from "./page.module.css";

import '@solvimon/sdk';

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <solvimon-checkout />
      </main>
    </div>
  );
}
