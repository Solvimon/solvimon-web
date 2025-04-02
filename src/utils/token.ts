const TOKEN_DELIMITER = '.';

export const parseToken = (
    token?: string
): { tokenUserName: string; portalUrlResourceId: string } | undefined => {
    if (!token) {
        return undefined;
    }

    try {
        const decoded = atob(token);
        const delimiterIndex = decoded.lastIndexOf(TOKEN_DELIMITER);
        const [tokenUserName, portalUrlResourceId] = [
            decoded.substring(0, delimiterIndex),
            decoded.substring(delimiterIndex + 1),
        ];

        return { tokenUserName, portalUrlResourceId };
    } catch (err) {
        throw new Error('Invalid token');
    }
};