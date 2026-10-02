<script setup lang="ts">
import type { MarkdownInlineNode } from '@/utils/markdownSubset';

// Interpolation only: every value reaches the DOM as text, never as markup.

defineProps<{ nodes: MarkdownInlineNode[] }>();
</script>

<template>
    <template v-for="(node, index) in nodes" :key="index">
        <template v-if="node.type === 'text'">{{ node.value }}</template>
        <br v-else-if="node.type === 'break'" />
        <strong v-else-if="node.type === 'bold'"><MarkdownInline :nodes="node.children" /></strong>
        <em v-else-if="node.type === 'italic'"><MarkdownInline :nodes="node.children" /></em>
        <u v-else-if="node.type === 'underline'"><MarkdownInline :nodes="node.children" /></u>
        <a
            v-else-if="node.type === 'link'"
            :href="node.href"
            target="_blank"
            rel="noopener noreferrer"
            class="underline"
        >
            <MarkdownInline :nodes="node.children" />
        </a>
    </template>
</template>
