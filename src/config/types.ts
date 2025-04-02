import { Environment } from "@solvimon/types";

export interface Config {
    apiUrls: {
        identity: string;
        config: string;
        transaction: string;
        event: string;
    };
}
