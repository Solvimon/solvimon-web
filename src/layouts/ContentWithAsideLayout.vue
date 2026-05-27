<template>
    <div class="sv-layout grid w-full grid-cols-1 gap-4">
        <div v-if="$slots['header']" class="sv-layout__header">
            <slot name="header" />
        </div>

        <div class="sv-layout__body flex flex-col items-start gap-6 md:flex-row">
            <div class="sv-layout__content grid w-full grow grid-cols-1 gap-4 md:w-auto">
                <slot name="content" />
            </div>

            <aside class="sv-layout__aside grid w-full grid-cols-1 gap-4 md:w-80 md:shrink-0">
                <slot name="aside" />
            </aside>
        </div>
    </div>
</template>
