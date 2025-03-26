import { StorybookConfig } from '@storybook/vue3-vite';
import { join, dirname, resolve } from 'path';

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string) {
  return dirname(require.resolve(join(value, 'package.json')));
}

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|js)'],
  addons: [
    getAbsolutePath('@storybook/addon-links'),
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-interactions'),
  ],
  framework: {
    // We need framework name to be prefixed with the absolute path, as we're using a monorepo
    // @ts-ignore-next-line
    name: getAbsolutePath('@storybook/vue3-vite'),
    options: {},
  },
  core: {
    disableTelemetry: true, // disables usage tracking
  },
  async viteFinal(config, options) {
    config.base = '/storybook/'

    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        '@': resolve(__dirname, '../src'),
      }
    }

    return config
  },
};

export default config;
