<script setup lang="ts">
import { Toggle, Typography, useIntl } from '@solvimon/solvimon-ui';

defineProps<{ noSpacing?: boolean }>();

const model = defineModel<boolean>({ required: true });

const { $t } = useIntl();
</script>

<template>
    <Toggle v-model="model" :no-spacing="noSpacing" label-position="before">
        <template #inline-label>
            <div class="flex grow flex-col">
                <Typography tag="span">{{
                    $t({
                        defaultMessage: 'Company purchase',
                        id: 'checkout.company_purchase_toggle.title',
                        description: 'The title of the company purchase toggle in the checkout',
                    })
                }}</Typography>
                <Typography tag="span" variant="body-xs" shade="lighter">
                    {{
                        $t({
                            defaultMessage: 'I am purchasing on behalf of a company',
                            id: 'checkout.company_purchase_toggle.sub_title',
                            description:
                                'The subtitle of the company purchase toggle in the checkout',
                        })
                    }}
                </Typography>
            </div>
        </template>
    </Toggle>
</template>
