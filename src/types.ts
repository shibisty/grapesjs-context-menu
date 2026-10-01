import type { Component, Editor } from 'grapesjs';

/** Ids of the built-in menu items (in their default order). */
export type BuiltinItemId =
  | 'add'
  | 'parent'
  | 'child'
  | 'up'
  | 'down'
  | 'move'
  | 'clone'
  | 'styles'
  | 'delete';

/** Every user-visible string of the plugin. */
export interface ContextMenuLabels {
  add: string;
  noBlocks: string;
  selectParent: string;
  selectChild: string;
  moveUp: string;
  moveDown: string;
  move: string;
  clone: string;
  viewStyles: string;
  delete: string;
  hierarchyTitle: string;
}

/** Context passed to custom item callbacks. */
export interface MenuContext {
  editor: Editor;
  /** The component the menu was opened for. */
  component: Component;
  /** Where the menu was opened from. */
  source: 'canvas' | 'layers';
}

/**
 * One row of the context menu. Built-in rows have `id` from {@link BuiltinItemId};
 * custom rows (added through `extendMenu`) must provide `run`.
 */
export interface MenuItem {
  id: string;
  label: string;
  /** Short text/emoji shown in front of the label. */
  icon?: string;
  disabled?: boolean;
  /** Rendered in red (destructive action). */
  danger?: boolean;
  /** Draws a separator line ABOVE this item. */
  separator?: boolean;
  /** Called on click. Built-in items already have their own handler. */
  run?: (ctx: MenuContext) => void;
}

export interface ContextMenuOptions {
  /**
   * Restrict the "Add element" submenu to these block ids.
   * `null` (default) = every block from the Block Manager.
   */
  blocks?: string[] | null;
  /** Inject the plugin CSS into the page. Default: `true`. */
  injectCss?: boolean;
  /** Right-click menu inside the canvas. Default: `true`. */
  canvasMenu?: boolean;
  /** Right-click menu on Layer Manager rows. Default: `true`. */
  layersMenu?: boolean;
  /** Clickable "Name ▾" badge with ancestors over the selected element. Default: `true`. */
  hierarchyBadge?: boolean;
  /**
   * Command run by "View styles". The item is hidden when the command
   * is not registered. Default: `'layers-sidebar:show-styles'`
   * (provided by the companion sidebar plugin). `null` hides the item.
   */
  viewStylesCommand?: string | null;
  /**
   * Label overrides. By default labels come from `editor.I18n`
   * (built-in locales: en, ru, uk) under the `contextMenu.*` keys.
   */
  labels?: Partial<ContextMenuLabels>;
  /**
   * Hook to change the item list before the menu is rendered:
   * reorder, remove or append your own items.
   */
  extendMenu?: (items: MenuItem[], ctx: MenuContext) => MenuItem[];
}

export type ResolvedOptions = Required<Omit<ContextMenuOptions, 'extendMenu' | 'labels'>> & {
  labels: Partial<ContextMenuLabels>;
  extendMenu?: ContextMenuOptions['extendMenu'];
};
