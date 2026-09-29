import { Link } from 'react-router';

/**
 * The brand: the mark plus the lowercase wordmark, together the home link.
 * The mark is decorative (`alt=""`); the wordmark text is the link's
 * accessible name. The product name is not translated, so the wordmark is a
 * constant rather than an i18n string.
 */
export function Logo() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 rounded-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus pointer-coarse:min-h-11"
    >
      <img src="/logo-mark.svg" alt="" width={26} height={26} className="size-[26px] shrink-0" />
      <span className="text-title font-semibold leading-none tracking-[-0.03em] text-ink">
        legajo
      </span>
    </Link>
  );
}
