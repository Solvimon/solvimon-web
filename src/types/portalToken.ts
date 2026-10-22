/** The answer to `POST /portal/token`, which exchanges the handle of a `SIGNED_TOKEN` link. */
export interface PortalToken {
    issued_at: string;
    access_token: string;
    /** Seconds until the link expires: the token lives as long as the link. */
    access_token_expires_in: number;
    access_token_expires_at: string;
    token_type: 'bearer';
}
