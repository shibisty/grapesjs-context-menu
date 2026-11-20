import type { ContextMenuOptions, ResolvedOptions } from './types';
import type { PluginMeta } from './contract';

export const DEFAULT_OPTIONS: ResolvedOptions = {
  blocks: null,
  injectCss: true,
  canvasMenu: true,
  layersMenu: true,
  hierarchyBadge: true,
  fontsMenu: true,
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

export const PLUGIN_ID = 'grapesjs-context-menu';
/** Version of this package (a test checks it against package.json). */
export const VERSION = '1.3.0';

/** Options for forms (plugin contract): all apply live except the badge and CSS. */
export const META: PluginMeta = {
  id: PLUGIN_ID,
  version: VERSION,
  title: 'Context Menu',
  description: 'Right-click menu in the canvas and Layer Manager, hierarchy badge over the selection.',
  options: [
    { key: 'canvasMenu', type: 'boolean', default: true, title: 'Menu in the canvas', live: true },
    { key: 'layersMenu', type: 'boolean', default: true, title: 'Menu in the Layer Manager', live: true },
    { key: 'hierarchyBadge', type: 'boolean', default: true, title: 'Hierarchy badge', description: 'Clickable "Name ▾" over the selected element.' },
    { key: 'fontsMenu', type: 'boolean', default: true, title: '"Font" submenu', description: 'With grapesjs-fonts.', live: true },
    { key: 'blocks', type: 'json', default: null, title: '"Add element" blocks', description: 'Block ids, e.g. ["text", "image"]; null — all blocks.', live: true },
    { key: 'viewStylesCommand', type: 'string', default: 'layers-sidebar:show-styles', title: '"View styles" command', description: 'Empty — no item.', live: true, advanced: true },
    { key: 'labels', type: 'json', default: {}, title: 'Texts', description: 'Overrides of menu texts, e.g. { "delete": "Remove" }.', live: true, advanced: true },
    { key: 'injectCss', type: 'boolean', default: true, title: 'Inject CSS', advanced: true },
  ],
};

/** The options a form can show. */
export function publicOptions(o: ResolvedOptions): Record<string, unknown> {
  return {
    canvasMenu: o.canvasMenu,
    layersMenu: o.layersMenu,
    hierarchyBadge: o.hierarchyBadge,
    fontsMenu: o.fontsMenu,
    blocks: o.blocks,
    viewStylesCommand: o.viewStylesCommand,
    labels: { ...o.labels },
    injectCss: o.injectCss,
  };
}
