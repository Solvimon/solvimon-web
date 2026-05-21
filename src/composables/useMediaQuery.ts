import { onMounted, onUnmounted, ref } from 'vue';

export function useMediaQuery(query: string) {
    const matches = ref(false);
    let mediaQueryList: MediaQueryList;

    const handler = (event: MediaQueryListEvent) => {
        matches.value = event.matches;
    };

    onMounted(() => {
        mediaQueryList = window.matchMedia(query);
        matches.value = mediaQueryList.matches;
        mediaQueryList.addEventListener('change', handler);
    });

    onUnmounted(() => {
        mediaQueryList?.removeEventListener('change', handler);
    });

    return matches;
}
