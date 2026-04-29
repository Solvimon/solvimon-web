import type { Environment, PlatformBranding } from '@solvimon/solvimon-types';
import type { IntlMessages } from '@solvimon/solvimon-ui';
import type { SolvimonBillingInformationEntryProps } from '@/public/components/BillingInformation/BillingInformation.entry.types';
import type { SolvimonBillingInformationFormEntryProps } from '@/public/components/BillingInformationForm/BillingInformationForm.entry.types';
import type { SolvimonCustomerPaymentMethodsEntryProps } from '@/public/components/CustomerPaymentMethods/CustomerPaymentMethods.entry.types';
import type { SolvimonInvoiceEntryProps } from '@/public/components/Invoice/Invoice.entry.types';
import type { SolvimonInvoiceDetailsEntryProps } from '@/public/components/InvoiceDetails/InvoiceDetails.entry.types';
import type { SolvimonInvoicesListEntryProps } from '@/public/components/InvoicesList/InvoicesList.entry.types';
import type { SolvimonPaymentMethodFormEntryProps } from '@/public/components/PaymentMethodForm/PaymentMethodForm.entry.types';
import type { SolvimonPaymentHistoryEntryProps } from '@/public/components/PaymentHistory/PaymentHistory.entry.types';
import type { SolvimonSubscriptionSchedulesEntryProps } from '@/public/components/SubscriptionSchedules/SubscriptionSchedules.entry.types';
import type { SolvimonSubscriptionsListEntryProps } from '@/public/components/SubscriptionsList/SubscriptionsList.entry.types';
import type { SolvimonWalletBalancesEntryProps } from '@/public/components/WalletBalances/WalletBalances.entry.types';
import type { SolvimonCheckoutEntryProps } from '@/public/screens/Checkout/Checkout.entry.types';
import type { SolvimonCustomerOverviewEntryProps } from '@/public/screens/CustomerOverview/CustomerOverview.entry.types';
import type { SolvimonUpgradeSubscriptionEntryProps } from '@/public/screens/UpgradeSubscription/UpgradeSubscription.entry.types';

/**
 * Shared configuration passed to all mounted Solvimon components and screens.
 * Extends the base entry props (environment, locale, branding, etc.).
 */
export interface SharedSolvimonMountConfig {
    environment?: Environment;
    locale?: string;
    dateLocale?: string;
    messages?: IntlMessages;
    experimentalFeatures?: unknown[];
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    onLog?: (entry: unknown) => void;
    branding?: PlatformBranding;
}

export type SolvimonMountConfig = SharedSolvimonMountConfig;

/**
 * Return type of the Solvimon core mount methods.
 */
export interface SolvimonMountInstance {
    /** Unmounts the Solvimon app from the container. */
    unmount: () => void;
}

interface RegisteredComponentEntryPropsById {
    invoice: SolvimonInvoiceEntryProps;
    'invoice-details': SolvimonInvoiceDetailsEntryProps;
    'invoices-list': SolvimonInvoicesListEntryProps;
    'payment-history': SolvimonPaymentHistoryEntryProps;
    'subscription-schedules': SolvimonSubscriptionSchedulesEntryProps;
    'subscriptions-list': SolvimonSubscriptionsListEntryProps;
    'customer-payment-methods': SolvimonCustomerPaymentMethodsEntryProps;
    'wallet-balances': SolvimonWalletBalancesEntryProps;
    'billing-information': SolvimonBillingInformationEntryProps;
    'billing-information-form': SolvimonBillingInformationFormEntryProps;
    'payment-method-form': SolvimonPaymentMethodFormEntryProps;
}

interface RegisteredScreenEntryPropsById {
    checkout: SolvimonCheckoutEntryProps;
    'customer-overview': SolvimonCustomerOverviewEntryProps;
    'upgrade-subscription': SolvimonUpgradeSubscriptionEntryProps;
}

/**
 * Registered screen ids that can be used with createScreen.
 */
export type RegisteredScreenId = keyof RegisteredScreenEntryPropsById;

/**
 * Registered component ids that can be used with createComponent.
 */
export type RegisteredComponentId = keyof RegisteredComponentEntryPropsById;

type InferConfiguration<TProps> = TProps extends { configuration: infer TConfiguration }
    ? TConfiguration
    : TProps extends { configuration?: infer TConfiguration }
      ? TConfiguration | undefined
      : undefined;

type InferPortalObject<TProps> = TProps extends { portalObject: infer TPortalObject }
    ? TPortalObject
    : TProps extends { portalObject?: infer TPortalObject }
      ? TPortalObject | undefined
      : undefined;

type MountContext<TPortalObject> = [TPortalObject] extends [undefined]
    ? Record<never, never>
    : undefined extends TPortalObject
      ? { portalObject?: Exclude<TPortalObject, undefined> }
      : { portalObject: TPortalObject };

export type ComponentConfigurationById = {
    [TId in RegisteredComponentId]: InferConfiguration<RegisteredComponentEntryPropsById[TId]>;
};

export type ScreenConfigurationById = {
    [TId in RegisteredScreenId]: InferConfiguration<RegisteredScreenEntryPropsById[TId]>;
};

type ComponentConfigurationProp<TConfiguration> = [TConfiguration] extends [undefined]
    ? { configuration?: undefined }
    : undefined extends TConfiguration
      ? { configuration?: Exclude<TConfiguration, undefined> }
      : { configuration: TConfiguration };

type ScreenConfigurationProp<TConfiguration> = [TConfiguration] extends [undefined]
    ? { configuration?: undefined }
    : undefined extends TConfiguration
      ? { configuration?: Exclude<TConfiguration, undefined> }
      : { configuration: TConfiguration };

export type ComponentMountConfiguration<TId extends RegisteredComponentId> = {
    container: Element | string;
} & MountContext<InferPortalObject<RegisteredComponentEntryPropsById[TId]>> &
    ComponentConfigurationProp<ComponentConfigurationById[TId]>;

export type ScreenMountConfiguration<TId extends RegisteredScreenId> = {
    container: Element | string;
} & MountContext<InferPortalObject<RegisteredScreenEntryPropsById[TId]>> &
    ScreenConfigurationProp<ScreenConfigurationById[TId]>;

export interface CoreConfiguration<TConfig extends SolvimonMountConfig = SolvimonMountConfig> {
    config: TConfig;
    createComponent: <TId extends RegisteredComponentId>(
        id: TId,
        configuration: ComponentMountConfiguration<TId>,
    ) => SolvimonMountInstance['unmount'];
    createScreen: <TId extends RegisteredScreenId>(
        id: TId,
        configuration: ScreenMountConfiguration<TId>,
    ) => SolvimonMountInstance['unmount'];
}
