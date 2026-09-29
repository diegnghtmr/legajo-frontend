import { useTranslation } from 'react-i18next';

import type { LinkageId, RepresentationId } from '../../infrastructure/schemas/clustering';
import { Button } from '../../shared/components/ui/button';
import { cn } from '../../shared/lib/cn';
import type { AppliedCut } from './ClusteringParametersPanel';

export interface ParametersSummaryBarProps {
  /** Shown only once the parameter panel has scrolled out of view. */
  visible: boolean;
  representation: RepresentationId;
  linkages: readonly LinkageId[];
  appliedCut?: AppliedCut;
  /** Scrolls the parameter panel back into view and focuses its first control. */
  onEdit: () => void;
}

/** The linkage list a narrow bar can afford: the first one and how many more. */
function compactLinkages(linkages: readonly LinkageId[]): string {
  const [first, ...rest] = linkages;
  if (first === undefined) {
    return '—';
  }
  return rest.length > 0 ? `${first} +${rest.length}` : first;
}

function Divider() {
  return <span aria-hidden="true" className="h-4 w-px shrink-0 bg-hairline-strong" />;
}

/**
 * A one-line summary pinned directly under the shell's top bar while the
 * parameter panel is out of view: the representation, the selected linkages,
 * the applied cut and an `Editar` button back to the panel. It overlays the
 * top of the scrolled content and reserves no space of its own (a zero-height
 * sticky anchor holds it). While hidden it is `aria-hidden` and `inert` and holds
 * no button at all, so nothing focusable sits inside an `aria-hidden` subtree. The light backdrop blur here is the only blurred surface in the app.
 */
export function ParametersSummaryBar({
  visible,
  representation,
  linkages,
  appliedCut,
  onEdit,
}: ParametersSummaryBarProps) {
  const { t } = useTranslation();

  return (
    <div className="pointer-events-none sticky top-(--shell-header-h) z-20 h-0">
      <div
        data-visible={visible}
        role={visible ? 'region' : undefined}
        aria-label={visible ? t('clustering.params.summary.label') : undefined}
        aria-hidden={!visible}
        inert={!visible}
        className={cn(
          'absolute inset-x-0 top-0 flex items-center gap-x-3 border-b border-hairline bg-paper-raised/85 px-4 py-2 shadow-card backdrop-blur-[8px] motion-safe:transition-[opacity,translate] motion-safe:duration-(--dur-base) motion-safe:ease-out',
          visible ? 'pointer-events-auto translate-y-0 opacity-100' : 'opacity-0 -translate-y-1',
        )}
      >
        <span className="shrink-0 text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary max-sm:sr-only">
          {t('clustering.params.summary.eyebrow')}
        </span>
        <span className="min-w-0 truncate font-mono text-mono text-ink">{representation}</span>
        <Divider />
        {/* The bar is one line: below `sm` the linkages collapse to the first
         * one and a count, while assistive technology keeps the full list. */}
        <span className="min-w-0 truncate font-mono text-mono text-ink-secondary">
          <span className="max-sm:sr-only">{linkages.length > 0 ? linkages.join(', ') : '—'}</span>
          <span aria-hidden="true" className="sm:hidden">
            {compactLinkages(linkages)}
          </span>
        </span>
        {appliedCut && (
          <>
            <Divider />
            <span className="min-w-0 truncate font-mono text-mono text-ink">
              {t('clustering.params.summary.cut', {
                linkage: appliedCut.linkageId,
                k: appliedCut.k,
              })}
            </span>
          </>
        )}
        {visible && (
          <Button variant="secondary" onClick={onEdit} className="ml-auto h-7 shrink-0 px-2.5">
            {t('clustering.params.summary.edit')}
          </Button>
        )}
      </div>
    </div>
  );
}
