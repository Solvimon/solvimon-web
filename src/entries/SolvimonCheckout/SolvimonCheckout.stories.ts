import type { Meta, StoryFn, StoryObj } from '@storybook/vue3';

import { SolvimonCheckout } from './SolvimonCheckout.ce.ts'

customElements.define('solvimon-checkout', SolvimonCheckout);

const meta: Meta<typeof SolvimonCheckout> = {
  title: 'solvimon-checkout',
};

export default meta;

const Template: StoryFn<typeof SolvimonCheckout> = (args) => ({
  setup() {
      return { args };
  },
  template: `
    <solvimon-checkout v-bind="args" />
  `,
});

export const Default = Template.bind({});
Default.args = {};
