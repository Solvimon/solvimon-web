import { request } from '../utils/request';
import { useConfig } from '../components/ConfigProvider/composables/useConfig';
import { Config } from '../config/types';


export const getAccessToken = (tokenUserName: string) => {
    const config = useConfig();
    const endpoint = `${config.apiUrls.identity}/oauth/token`; 

    return request(endpoint, { token_alias: tokenUserName }, { method: 'POST', enableAccessToken: false });
}

// Retrieve config as param, as useConfig() is not available in this context, because it's called from setInterval
export const refreshAccessToken = (config: Config) => {
    const endpoint = `${config.apiUrls.identity}/oauth/refresh-token`;

    return request(endpoint, {}, { method: 'POST', enableAccessToken: false });
};