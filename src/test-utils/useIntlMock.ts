export const mockUseIntl = () => ({
    $t: (message: { defaultMessage: string }, values?: Record<string, string>) => {
        let result = message.defaultMessage;
        if (values) {
            Object.entries(values).forEach(([key, value]) => {
                result = result.replace(`{${key}}`, String(value));
            });
        }
        return result;
    },
    formatDate: ({
        date,
        format,
        timezone,
    }: {
        date: Date | string;
        format: 'date' | 'dateTime';
        timezone?: string;
    }) => {
        const options: Intl.DateTimeFormatOptions =
            format === 'date'
                ? { day: '2-digit', month: '2-digit', year: 'numeric' }
                : {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                  };
        return new Intl.DateTimeFormat('en-GB', {
            ...options,
            ...(timezone ? { timeZone: timezone } : {}),
        }).format(new Date(date));
    },
    formatMessage: (message: { defaultMessage: string }, values?: Record<string, string>) => {
        let result = message.defaultMessage;
        if (values) {
            Object.entries(values).forEach(([key, value]) => {
                result = result.replace(`{${key}}`, String(value));
            });
        }
        return result;
    },
    formatNumber: (n: number) => String(n),
});
