<template>
    <div class="grid w-full grid-cols-1 gap-4">
        <div v-if="$slots['header']">
            <slot name="header" />
        </div>

        <div class="flex flex-col items-start gap-6 md:flex-row">
            <div class="grid w-full grow grid-cols-1 gap-4 md:w-auto">
                <slot name="content" />
            </div>

            <aside class="grid w-full grid-cols-1 gap-4 md:w-80 md:shrink-0">
                <slot name="aside" />
            </aside>
        </div>
    </div>
</template>
