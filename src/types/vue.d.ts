import 'vue';
import '@vue/runtime-dom';

// Allow common HTML attributes and event handlers on all components.
// UI library components pass these through via $attrs but don't declare them
// as typed props, so vue-tsc rejects them without this augmentation.
declare module 'vue' {
    interface ComponentCustomProps {
        'aria-label'?: string;
        'aria-disabled'?: boolean | string;
        dataTestid?: string;
        href?: string;
        onKeydown?: (event: KeyboardEvent) => void;
        onBlur?: (event: FocusEvent) => void;
    }
}

declare module '@vue/runtime-dom' {
    interface HTMLAttributes {
        'data-testid'?: string;
    }
}
