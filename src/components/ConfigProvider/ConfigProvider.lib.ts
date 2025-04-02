import { InjectionKey } from "vue";
import { getConfig } from "../../config/lib";

export const CONFIG_INJECTION_KEY: InjectionKey<ReturnType<typeof getConfig>> = Symbol('config');
