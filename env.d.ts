/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

declare module '*.vue' {
    import Vue from 'vue';
    export default Vue;
}

declare module '*.css?inline' {
    const css: string;
    export default css;
}
