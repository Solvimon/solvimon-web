<script setup lang="ts">
import { DEVICE_PRESETS, MIN_VIEWPORT_SIZE } from '../playgroundState';
import type { ViewportSelection, ViewportSize } from '../playgroundState';

const props = defineProps<{
    selection: ViewportSelection;
    size: ViewportSize;
    isFramed: boolean;
}>();

const emit = defineEmits<{
    select: [value: ViewportSelection];
    resize: [size: ViewportSize];
    rotate: [];
}>();

const handleSelect = (event: Event) => {
    const select = event.target;

    if (select instanceof HTMLSelectElement) {
        emit('select', select.value);
    }
};

const handleDimension = (dimension: 'width' | 'height', event: Event) => {
    const input = event.target;

    if (!(input instanceof HTMLInputElement)) return;

    const value = Number(input.value);

    if (!Number.isFinite(value)) {
        input.value = String(props.size[dimension]);
        return;
    }

    emit('resize', { ...props.size, [dimension]: value });
};
</script>

<template>
    <div class="toolbar">
        <select class="device-select" :value="selection" aria-label="Device" @change="handleSelect">
            <option value="desktop">Desktop</option>
            <option value="responsive">Responsive</option>
            <optgroup label="Devices">
                <option v-for="preset in DEVICE_PRESETS" :key="preset.id" :value="preset.id">
                    {{ preset.label }} — {{ preset.width }}×{{ preset.height }}
                </option>
            </optgroup>
        </select>

        <div class="dimensions" :class="{ disabled: !isFramed }">
            <input
                class="dimension"
                type="number"
                :min="MIN_VIEWPORT_SIZE"
                :value="size.width"
                :disabled="!isFramed"
                aria-label="Width"
                @change="handleDimension('width', $event)"
            />
            <span class="times">×</span>
            <input
                class="dimension"
                type="number"
                :min="MIN_VIEWPORT_SIZE"
                :value="size.height"
                :disabled="!isFramed"
                aria-label="Height"
                @change="handleDimension('height', $event)"
            />
        </div>

        <button
            class="rotate"
            type="button"
            :disabled="!isFramed"
            title="Rotate"
            aria-label="Rotate"
            @click="emit('rotate')"
        >
            ⟲
        </button>
    </div>
</template>

<style scoped>
.toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 32px;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
}

.device-select {
    padding: 4px 8px;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    background: #ffffff;
    color: #475569;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
}

.dimensions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.dimensions.disabled {
    opacity: 0.45;
}

.dimension {
    width: 62px;
    padding: 4px 6px;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    background: #ffffff;
    color: #0f172a;
    font-family: 'Fira Code', 'Cascadia Code', monospace;
    font-size: 12px;
    text-align: center;
}

.dimension:disabled {
    cursor: not-allowed;
}

.times {
    color: #94a3b8;
    font-size: 12px;
}

.rotate {
    padding: 3px 9px;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    background: #ffffff;
    color: #475569;
    font-size: 14px;
    line-height: 1.2;
    cursor: pointer;
}

.rotate:hover:not(:disabled) {
    background: #f1f5f9;
    color: #0f172a;
}

.rotate:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}
</style>
