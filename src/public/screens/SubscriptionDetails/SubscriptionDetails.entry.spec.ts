import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import SubscriptionDetailsEntry from './SubscriptionDetails.entry.vue';

vi.mock('@/components/providers', () => ({
    EntryProvider: defineComponent({
        name: 'EntryProviderStub',
        setup:
            (_props, { slots }) =>
            () =>
                h('div', slots.default?.()),
    }),
}));

vi.mock('./SubscriptionDetails.entry.view.vue', () => ({
    default: defineComponent({
        name: 'SubscriptionDetailsEntryViewStub',
        setup:
            (_props, { slots }) =>
            () =>
                h('div', slots.default?.({})),
    }),
}));

vi.mock('./SubscriptionDetails.vue', () => ({
    default: defineComponent({
        name: 'SubscriptionDetailsStub',
        props: { avatar: String },
        setup: () => () => h('div'),
    }),
}));

const passedAvatar = (props: Record<string, unknown>) =>
    mount(SubscriptionDetailsEntry, {
        props: { configuration: { subscriptionId: 'ppsu_1' }, ...props } as never,
    })
        .findComponent({ name: 'SubscriptionDetailsStub' })
        .props('avatar');

describe('Subscription details entry', () => {
    it('shows the branding emblem as the avatar', () => {
        expect(
            passedAvatar({
                branding: { emblem: { public_url: 'https://cdn.example/emblem.png' } },
            }),
        ).toBe('https://cdn.example/emblem.png');
    });

    it('shows no avatar without a branding emblem', () => {
        expect(passedAvatar({})).toBeUndefined();
    });
});
