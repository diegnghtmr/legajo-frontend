import { useTranslation } from 'react-i18next';

import { useElementWidth } from '../../shared/hooks/useElementWidth';
import {
  Dendrogram,
  type DendrogramCut,
  type DendrogramLeafLabel,
} from '../../shared/components/Dendrogram';
import type { DendrogramRow } from '../../shared/components/dendrogramLayout';
import { Panel, PanelHeader } from '../../shared/components/Panel';
import type { LinkageId } from '../../infrastructure/schemas/clustering';
import { dendrogramCardHeight } from './dendrogramGridSizing';

export interface DendrogramCardProps {
  linkageId: LinkageId;
  linkageDisplayName: string;
  rows: readonly DendrogramRow[];
  leafOrder: readonly number[];
  leafLabels?: readonly DendrogramLeafLabel[];
  cut?: DendrogramCut;
}

/** Same as `Dendrogram`'s own `DEFAULT_WIDTH`: what a card renders at before
 * its `ResizeObserver` ever reports a real measurement. */
const INITIAL_WIDTH = 640;

/**
 * One dendrogram grid card: a `Panel` headed by the linkage's display name,
 * with the `Dendrogram` sized to fill the card's own measured width
 * (`useElementWidth`, never a fixed pixel width) and to a height that
 * follows the leaf count (`dendrogramGridSizing.ts`). Drawing itself — the
 * merges, the cut line, the cluster labels — stays entirely `Dendrogram`'s
 * own responsibility; this only measures and sizes.
 */
export function DendrogramCard({
  linkageId,
  linkageDisplayName,
  rows,
  leafOrder,
  leafLabels,
  cut,
}: DendrogramCardProps) {
  const { t } = useTranslation();
  const [containerRef, width] = useElementWidth<HTMLDivElement>(INITIAL_WIDTH);
  const height = dendrogramCardHeight(leafOrder.length);

  return (
    <div data-testid={`linkage-dendrogram-${linkageId}`}>
      <Panel>
        <PanelHeader title={linkageDisplayName} />
        <div ref={containerRef} className="mt-3">
          <Dendrogram
            rows={rows}
            leafOrder={leafOrder}
            leafLabels={leafLabels}
            cut={cut}
            width={width}
            height={height}
            ariaLabel={t('clustering.dendrogram.ariaLabel', { linkage: linkageDisplayName })}
          />
        </div>
      </Panel>
    </div>
  );
}
