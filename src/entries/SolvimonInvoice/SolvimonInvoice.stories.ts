import type { Meta, StoryFn, StoryObj } from '@storybook/vue3';

import { SolvimonInvoice } from './SolvimonInvoice.ce'

customElements.define('solvimon-invoice', SolvimonInvoice);

const meta: Meta<typeof SolvimonInvoice> = {
  title: 'solvimon-invoice',
};

export default meta;

const Template: StoryFn<typeof SolvimonInvoice> = (args) => ({
  setup() {
      return { args };
  },
  template: `
    <h1 class="text-2xl">Host app heading (with text-2xl class)</h1>
    <solvimon-invoice v-bind="args" />
  `,
});

export const Default = Template.bind({});
Default.args = {};
