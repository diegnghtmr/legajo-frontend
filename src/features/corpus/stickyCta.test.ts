import { describe, expect, it } from 'vitest';

import {
  STICKY_CTA_HEIGHT_VAR,
  STICKY_CTA_SCROLL_MARGIN_BOTTOM,
  applyStickyCtaHeight,
} from './stickyCta';

describe('stickyCta', () => {
  it('sets the shared custom property to the measured height, in px', () => {
    const target = document.createElement('div');

    applyStickyCtaHeight(target, 260);

    expect(target.style.getPropertyValue(STICKY_CTA_HEIGHT_VAR)).toBe('260px');
  });

  it('builds a scroll-margin-bottom that reads the same custom property plus a gap, with a fallback', () => {
    expect(STICKY_CTA_SCROLL_MARGIN_BOTTOM).toContain(STICKY_CTA_HEIGHT_VAR);
    expect(STICKY_CTA_SCROLL_MARGIN_BOTTOM).toContain('calc(');
    expect(STICKY_CTA_SCROLL_MARGIN_BOTTOM).toContain('192px');
  });
});
