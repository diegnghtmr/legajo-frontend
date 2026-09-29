import { LayoutGrid, Network } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '../../shared/components/ui/badge';

export interface LeaderBadgeProps {
  /** `tree` marks the best cophenetic (tree fidelity), `partition` the best silhouette at `k_ref`. */
  kind: 'tree' | 'partition';
}

/**
 * The read-only leader tag: an ink glyph block holding a lucide icon, then
 * the label. The icon is decorative; the label carries the meaning.
 */
export function LeaderBadge({ kind }: LeaderBadgeProps) {
  const { t } = useTranslation();
  const Icon = kind === 'tree' ? Network : LayoutGrid;

  return (
    <Badge variant="leader" data-slot="leader-badge">
      <span
        data-slot="leader-glyph"
        className="flex w-[22px] items-center justify-center self-stretch bg-ink text-primary-foreground"
      >
        <Icon aria-hidden="true" role="presentation" className="size-3.5" />
      </span>
      {kind === 'tree' ? t('clustering.leaderTree') : t('clustering.leaderPartition')}
    </Badge>
  );
}
