import { vi } from 'vitest';

vi.mock('@solvimon/solvimon-ui', async () => {
    const actual = await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui');

    return {
        ...actual,
        useIntl: () => ({
            $t: (
                message: {
                    defaultMessage: string;
                },
                _?: Record<string, string>,
            ) => {
                return message.defaultMessage;
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
        }),
    };
});
