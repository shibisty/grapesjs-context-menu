import type { ContextMenuOptions, ResolvedOptions } from './types';

export const DEFAULT_OPTIONS: ResolvedOptions = {
  blocks: null,
  injectCss: true,
  canvasMenu: true,
  layersMenu: true,
  hierarchyBadge: true,
  viewStylesCommand: 'layers-sidebar:show-styles',
  labels: {},
  extendMenu: undefined,
};

/**
 * Shallow merge with defaults; `labels` is merged one level deeper so a
 * single overridden label does not wipe the others. `undefined` values in
 * the user options are ignored (they must not erase a default).
 */
export function resolveOptions(opts?: ContextMenuOptions | null): ResolvedOptions {
  const out: ResolvedOptions = { ...DEFAULT_OPTIONS, labels: {} };
  if (!opts) return out;
  (Object.keys(opts) as (keyof ContextMenuOptions)[]).forEach((key) => {
    const value = opts[key];
    if (value === undefined) return;
    if (key === 'labels') {
      out.labels = { ...(value as ResolvedOptions['labels']) };
    } else {
      (out as unknown as Record<string, unknown>)[key] = value;
    }
  });
  return out;
}
