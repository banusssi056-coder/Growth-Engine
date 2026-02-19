export const CURRENCY_CONFIG = {
    locale: 'en-US',
    currency: 'USD',
    symbol: '$'
};

export const formatCurrency = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined || value === '') return '-';

    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) return '-';

    return new Intl.NumberFormat(CURRENCY_CONFIG.locale, {
        style: 'currency',
        currency: CURRENCY_CONFIG.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(numValue);
};
