<script setup lang="ts">
import { Section, useIntl } from '@solvimon/ui';
import SeatsEditor from './SeatsEditor.vue';
import type { ConfiguredMeterValue } from '@solvimon/types';
import type { PlanCustomizationEditorProps } from './PlanCustomizationEditor.types';

defineProps<PlanCustomizationEditorProps>();
const seatsModel = defineModel<ConfiguredMeterValue[]>('seatsValues', { required: true });

const { $t } = useIntl();
</script>

<template>
    <Section
        :title="
            $t({
                defaultMessage: 'Customize plan',
                id: 'checkout.customize_plan_block.title',
                description: 'The title of the customize plan block in the checkout form',
            })
        "
        no-spacing
        no-border
        content-background="none"
    >
        <SeatsEditor
            v-model="seatsModel"
            :initial-seats-values="initialSeatsValues"
            :pricings="pricings"
        />
    </Section>
</template>
