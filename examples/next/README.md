This example shows how to mount the published `payment-method-form` SDK component in a Next.js app by using `createSolvimonCore` from `@solvimon/solvimon-web/core`.

The current example lives in [app/page.tsx](./app/page.tsx) and mounts the component into a `ref` container inside a client component.

Before using it for real, replace the placeholder `portalObject` and token with values returned by your backend.

## Getting Started

Run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) with your browser to see the result.

## Integration Pattern

```tsx
'use client';

import { createSolvimonCore } from '@solvimon/solvimon-web/core';
import { useEffect, useRef } from 'react';

const solvimon = createSolvimonCore({
    environment: 'DEV',
    locale: 'en-US',
    logLevel: 'info',
});

export default function Page() {
    const container = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!container.current) return;

        const unmount = solvimon.createComponent('payment-method-form', {
            container: container.current,
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

        return () => unmount?.();
    }, []);

    return <div ref={container} />;
}
```

The example also imports Adyen’s stylesheet in [app/globals.css](./app/globals.css), because the payment method form depends on it.
