import { afterEach, describe, expect, it } from 'vitest';

import { MAIN_CONTENT_ID } from '../../shared/lib/shellMetrics';
import { clearTraceTrigger, rememberTraceTrigger, restoreTraceTrigger } from './traceFocusReturn';

function appendButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  document.body.appendChild(button);
  return button;
}

afterEach(() => {
  document.body.replaceChildren();
  // Every test starts with a clean module-level slot: a previous test's own
  // trigger (or lack of one) must never leak into the next.
  clearTraceTrigger();
});

describe('traceFocusReturn', () => {
  it('focuses the remembered trigger and forgets it, so a second restore focuses nothing further', () => {
    const button = appendButton();
    rememberTraceTrigger(button);

    restoreTraceTrigger();
    expect(button).toHaveFocus();

    const main = document.createElement('main');
    main.id = MAIN_CONTENT_ID;
    main.tabIndex = -1;
    document.body.appendChild(main);
    button.focus(); // move focus back so the second restore's own effect is observable
    restoreTraceTrigger();
    expect(button).not.toHaveFocus();
  });

  it('falls back to the main landmark when the remembered trigger is no longer connected to the document', () => {
    const detachedButton = appendButton();
    rememberTraceTrigger(detachedButton);
    detachedButton.remove();

    const main = document.createElement('main');
    main.id = MAIN_CONTENT_ID;
    main.tabIndex = -1;
    document.body.appendChild(main);

    restoreTraceTrigger();

    expect(main).toHaveFocus();
  });

  it('clearTraceTrigger forgets the trigger without focusing anything', () => {
    const button = appendButton();
    rememberTraceTrigger(button);
    clearTraceTrigger();

    const main = document.createElement('main');
    main.id = MAIN_CONTENT_ID;
    main.tabIndex = -1;
    document.body.appendChild(main);

    restoreTraceTrigger();

    // Nothing was remembered (cleared before the restore), so the fallback
    // main landmark receives focus — never the earlier, now-forgotten button.
    expect(button).not.toHaveFocus();
    expect(main).toHaveFocus();
  });
});
