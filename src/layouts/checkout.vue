<template>
    <div class="grid grid-cols-1 gap-4 w-full">
        <div v-if="$slots['title']">
            <slot name="title" />
        </div>

        <div class="flex flex-col md:flex-row gap-6 items-start">
            <!-- content -->
            <div class="grid grid-cols-1 gap-4 grow w-full md:w-auto">
                <slot name="mobile-order-summary" />

                <slot name="payment-success-notification" />

                <slot name="plan-customization" />

                <slot name="express-payment-methods" />

                <slot name="customer-information-form" />

                <slot name="payment-methods" />
            </div>

            <!-- sidebar -->
            <div class="grid grid-cols-1 gap-2 w-full md:shrink-0 md:w-72">
                <slot name="order-summary" />

                <slot name="pay-button" />

                <slot name="kpis" />

                <slot name="terms-and-conditions" />
            </div>
        </div>
    </div>
</template>
