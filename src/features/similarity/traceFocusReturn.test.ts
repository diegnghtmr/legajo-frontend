import { afterEach, describe, expect, it } from 'vitest';

import { MAIN_CONTENT_ID } from '../../shared/lib/shellMetrics';
import { clearTraceTrigger, rememberTraceTrigger, restoreTraceTrigger } from './traceFocusReturn';

function appendButton(algorithmId?: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  if (algorithmId !== undefined) {
    button.setAttribute('data-algorithm-trigger', algorithmId);
  }
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
    const button = appendButton('levenshtein');
    rememberTraceTrigger(button, 'levenshtein');

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

  it('falls back to the main landmark when the remembered trigger is no longer connected to the document, and no same-algorithm trigger exists elsewhere', () => {
    const detachedButton = appendButton('levenshtein');
    rememberTraceTrigger(detachedButton, 'levenshtein');
    detachedButton.remove();

    const main = document.createElement('main');
    main.id = MAIN_CONTENT_ID;
    main.tabIndex = -1;
    document.body.appendChild(main);

    restoreTraceTrigger();

    expect(main).toHaveFocus();
  });

  it('resolves a same-algorithm trigger elsewhere in the document once the remembered element itself is disconnected — the breakpoint crossing lg while the trace stayed open, table swapped for list (or back)', () => {
    const tableRowButton = appendButton('levenshtein');
    rememberTraceTrigger(tableRowButton, 'levenshtein');
    tableRowButton.remove();

    // The below-`lg` list's own row button for that same algorithm, now the
    // only one actually mounted.
    const listRowButton = appendButton('levenshtein');
    // A different algorithm's own trigger, also present, must never be
    // mistaken for a match.
    appendButton('jaccard');

    restoreTraceTrigger();

    expect(listRowButton).toHaveFocus();
  });

  it('clearTraceTrigger forgets the trigger without focusing anything', () => {
    const button = appendButton('levenshtein');
    rememberTraceTrigger(button, 'levenshtein');
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
