import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

// The SDK's styles live in each component's shadow root, where `:root` matches nothing. Every `:root` rule (the
// design tokens, the brand defaults) is also written for `:host`, so the variables reach the components. Vite runs
// this when it inlines the CLI-built .sdk/tailwind.css into the components.
const rootToHost = {
    postcssPlugin: 'root-to-host',
    Rule(rule) {
        if (rule.selectors.includes(':root') && !rule.selectors.includes(':host')) {
            rule.selectors = [...rule.selectors, ':host'];
        }
    },
};

export default {
    plugins: [tailwindcss, autoprefixer, rootToHost],
};
