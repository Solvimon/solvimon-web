<script setup lang="ts">
import { IntlProvider, type IntlMessages } from '@solvimon/solvimon-ui';
import { computed, inject } from 'vue';
import type { TranslationOverrideProps } from './TranslationProvider.types';
import { asIntlMessages, TRANSLATION_SETTINGS_KEY } from './TranslationProvider.lib';

/**
 * Replaces a message or two for one part of the tree only — for wording that belongs to a single
 * screen while the component saying it is shared. Everything not overridden is inherited from the
 * app's own translations, so the locale and the rest of the copy stay as they are.
 *
 * The replacements are text that is already formatted, so each is handed on as a message that is
 * one literal: the bundle has no parser to read it as ICU.
 */
const LITERAL = 0; // TYPE.literal of @formatjs/icu-messageformat-parser, whose index imports the parser
const props = defineProps<TranslationOverrideProps>();

const settings = inject(TRANSLATION_SETTINGS_KEY, undefined);

const messages = computed<IntlMessages>(() => ({
    ...settings?.messages.value,
    ...asIntlMessages(
        Object.fromEntries(
            Object.entries(props.messages).map(([id, text]) => [
                id,
                [{ type: LITERAL, value: text }],
            ]),
        ),
    ),
}));
</script>

<template>
    <IntlProvider
        :locale="settings?.locale.value"
        :date-locale="settings?.dateLocale.value"
        :messages="messages"
        :show-timezones="false"
    >
        <slot />
    </IntlProvider>
</template>
