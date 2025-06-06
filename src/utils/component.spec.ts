import { getComponentName } from './component';
import { COMPONENT_TAG_PREFIX } from '@/constants';

describe('component utils', () => {
    describe('getComponentName()', () => {
        test('returns the component name prefixed with the component prefix', () => {
            const COMPONENT_NAME = 'some-component=name';

            expect(getComponentName(COMPONENT_NAME)).toEqual(
                `${COMPONENT_TAG_PREFIX}${COMPONENT_NAME}`
            );
        });
    });
});
