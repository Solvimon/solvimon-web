const TOKEN_DELIMITER = '.';

export function parseToken(token: string): { tokenUserName: string; portalUrlResourceId: string } {
    try {
        const decoded = atob(token);
        const delimiterIndex = decoded.lastIndexOf(TOKEN_DELIMITER);

        if (delimiterIndex === -1) {
            throw new Error('Invalid token');
        }

        const [tokenUserName, portalUrlResourceId] = [
            decoded.substring(0, delimiterIndex),
            decoded.substring(delimiterIndex + 1),
        ];

        return { tokenUserName, portalUrlResourceId };
    } catch (_err) {
        throw new Error('Invalid token');
    }
}
