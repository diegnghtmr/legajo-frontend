const DATE_LOCALES: Record<string, string> = { es: 'es', en: 'en-US' };
const DEFAULT_DATE_LOCALE = 'es';

/** The CPU model with its `(R)` and `(TM)` marks rendered as ® and ™. */
export function formatCpuModel(cpuModel: string): string {
  return cpuModel.replace(/\(R\)/gi, '®').replace(/\(TM\)/gi, '™');
}

/** `totalRamBytes` as binary gigabytes (GiB), one decimal. */
export function formatRamGib(totalRamBytes: number): string {
  return `${(totalRamBytes / 1024 ** 3).toFixed(1)} GiB`;
}

/** The date locale of a UI language; anything unknown reads as the default one. */
export function localeForLanguage(language: string): string {
  return DATE_LOCALES[language] ?? DEFAULT_DATE_LOCALE;
}

/**
 * The harness's ISO-8601 `measuredAt` instant as a localized medium date (day,
 * short month, year) and a 24-hour time, read in UTC (the machine's own zone never shifts it) and
 * marked as such. Falls back to the raw string when it cannot be parsed,
 * rather than showing "Invalid Date".
 */
export function formatMeasuredAt(measuredAt: string, language: string): string {
  const date = new Date(measuredAt);
  if (Number.isNaN(date.getTime())) {
    return measuredAt;
  }
  const formatted = new Intl.DateTimeFormat(localeForLanguage(language), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).format(date);
  return `${formatted} UTC`;
}
