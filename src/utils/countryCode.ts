import type { CountryCode } from '@solvimon/solvimon-types';
import { isValidCountryCode } from '@solvimon/solvimon-ui';

/** `isValidCountryCode` from solvimon-ui, which returns a plain boolean, as a type guard. */
export const isCountryCode = (value: string): value is CountryCode => isValidCountryCode(value);
