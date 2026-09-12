import { useLocale } from '@nibleaf/i18n/react';

/**
 * Locale-aware number/date formatters bound to the dashboard's active locale.
 * Arabic keeps its localized words and ordering while using Western digits.
 * Centralized so every count/date renders consistently with the chosen
 * language and the product-wide 0-9 numeral convention.
 */
export function useFormatters() {
  const { locale } = useLocale();
  const tag = localeTag(locale);
  return {
    number: (value: number | bigint, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(tag, options).format(value),
    /** A currency amount (default USD) with the locale's symbol placement and Western digits. */
    currency: (value: number, currency = 'USD') => formatCurrency(tag, value, currency),
    date: (value: string | number | Date) => new Intl.DateTimeFormat(tag, { dateStyle: 'medium' }).format(new Date(value)),
    /** A signed percentage like “+12.5%” / “−4%” for trend badges. `value` is
     *  already in percent units (e.g. 12.5 → “+12.5%”). `style:'percent'` lets
     *  Intl supply the locale percent sign + digits (Arabic-Indic ٪). */
    percent: (value: number) =>
      new Intl.NumberFormat(tag, { style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 1 }).format(value / 100),
    /** A short axis label (e.g. “Jun 23”) for time-series charts. */
    shortDate: (value: string | number | Date) => new Intl.DateTimeFormat(tag, { month: 'short', day: 'numeric' }).format(new Date(value)),
    /** Full date + time (e.g. for "last imported"), locale-aware. */
    dateTime: (value: string | number | Date) => new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)),
    /** Locale-aware relative time (e.g. “5m ago” / “قبل 5 دقائق”). Picks the
     *  largest sensible unit and lets Intl supply the words + digits. */
    relativeTime: (value: string | number | Date) => {
      const rtf = new Intl.RelativeTimeFormat(tag, { numeric: 'auto', style: 'narrow' });
      const diffMs = new Date(value).getTime() - Date.now();
      const abs = Math.abs(diffMs);
      const min = 60_000;
      const hour = 60 * min;
      const day = 24 * hour;
      const week = 7 * day;
      if (abs < min) return rtf.format(0, 'second');
      if (abs < hour) return rtf.format(Math.round(diffMs / min), 'minute');
      if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour');
      if (abs < week) return rtf.format(Math.round(diffMs / day), 'day');
      return rtf.format(Math.round(diffMs / week), 'week');
    },
  };
}

/** The BCP-47 tag used for UI formatting. Arabic uses Western 0-9 digits. */
export function localeTag(locale: string) {
  return locale.toLowerCase().startsWith('ar') ? `${locale}-u-nu-latn` : locale;
}

/** Whole-unit currency formatting (no trailing “.00”) so a free plan reads “$0”, not “$0.00”. */
export function formatCurrency(tag: string, value: number, currency = 'USD') {
  return new Intl.NumberFormat(tag, { style: 'currency', currency, maximumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value);
}

/** Trend of a views time-series: % change of the recent half vs the older half.
 *  Returns null when there isn't enough signal to compare (avoids noisy badges). */
export function viewsTrend(series: Array<{ views: number }>): { pct: number; direction: 'up' | 'down' | 'flat' } | null {
  if (series.length < 4) {
    return null;
  }
  const mid = Math.floor(series.length / 2);
  const prevSum = series.slice(0, mid).reduce((acc, s) => acc + s.views, 0);
  const currSum = series.slice(mid).reduce((acc, s) => acc + s.views, 0);
  if (prevSum === 0) {
    return currSum > 0 ? { pct: 100, direction: 'up' } : null;
  }
  const pct = Math.round(((currSum - prevSum) / prevSum) * 100);
  if (pct === 0) {
    return { pct: 0, direction: 'flat' };
  }
  return { pct: Math.abs(pct), direction: pct > 0 ? 'up' : 'down' };
}
