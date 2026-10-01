/**
 * grapesjs-context-menu
 * ---------------------
 * Right-click context menu for the GrapesJS canvas and Layer Manager, plus a
 * clickable hierarchy badge over the selected element.
 *
 * Menu items (in this order):
 *   - Add element        -> submenu with Block Manager blocks grouped by
 *                           category; the block is appended INTO the target
 *   - Select parent / Select child
 *   - Move up / Move down (order among siblings)
 *   - Move (drag)        -> the same `tlb-move` command as the toolbar
 *   - Duplicate          -> `tlb-clone`
 *   - View styles        -> runs `viewStylesCommand`; hidden when that
 *                           command is not registered
 *   - Delete
 *
 * Usage:
 *   import grapesjs from 'grapesjs';
 *   import contextMenu from 'grapesjs-context-menu';
 *   grapesjs.init({ plugins: [contextMenu], pluginsOpts: { [contextMenu]: { ... } } });
 *
 * or without a bundler (UMD build, global `grapesjsContextMenu`):
 *   grapesjs.init({ plugins: [grapesjsContextMenu.default] });
 */
import type { Component, Editor } from 'grapesjs';
import type { ContextMenuOptions } from './types';
import { resolveOptions } from './options';
import { createTranslator, registerMessages } from './i18n';
import { injectCss } from './styles';
import { ContextMenu } from './ContextMenu';
import { HierarchyBadge } from './HierarchyBadge';
import { componentFromCanvasEl, findByLayerEl, isAncestorOrSelf, isEditorAlive } from './utils/components';
import { framePointToPage } from './utils/dom';

export type {
  BuiltinItemId,
  ContextMenuLabels,
  ContextMenuOptions,
  MenuContext,
  MenuItem,
} from './types';
export { locales, SUPPORTED_LOCALES } from './i18n';
export { EVENTS } from './ContextMenu';

/** Public API stored on the editor, e.g. to open the menu programmatically. */
export interface ContextMenuApi {
  /** Opens the menu at viewport coordinates of the host page. */
  open(x: number, y: number, component: Component, source?: 'canvas' | 'layers'): void;
  close(): void;
  readonly isOpen: boolean;
  /** Removes every listener and element the plugin created. */
  destroy(): void;
}

type FrameDoc = Document & { __gjsCmBound?: boolean };

const API_KEY = '__contextMenu';

/** Returns the plugin API of an editor (undefined if the plugin isn't loaded). */
export function getContextMenu(editor: Editor): ContextMenuApi | undefined {
  return (editor as unknown as Record<string, ContextMenuApi | undefined>)[API_KEY];
}

function contextMenuPlugin(editor: Editor, opts: ContextMenuOptions = {}): void {
  // Applied twice to the same editor: the last call wins, no duplicate listeners.
  getContextMenu(editor)?.destroy();
  const options = resolveOptions(opts);
  let destroyed = false;
  registerMessages(editor);
  const t = createTranslator(editor, options.labels);
  if (options.injectCss) injectCss();

  const getFrameEl = (): HTMLIFrameElement | null => {
    try {
      return editor.Canvas.getFrameEl() || null;
    } catch {
      return null;
    }
  };
  const getFrameDoc = (): Document | null => {
    try {
      return getFrameEl()?.contentDocument || null;
    } catch {
      return null;
    }
  };

  const menu = new ContextMenu(editor, options, t, getFrameDoc);
  const badge = options.hierarchyBadge
    ? new HierarchyBadge(editor, {
        title: () => t('hierarchyTitle'),
        getFrameEl,
        beforeOpen: () => menu.close(),
        onEditorDestroyed: () => destroy(),
      })
    : null;

  // ---- Canvas ----------------------------------------------------------------

  const boundDocs: FrameDoc[] = [];

  const onCanvasContextMenu = (e: MouseEvent): void => {
    if (!isEditorAlive(editor)) return destroy();
    e.preventDefault();
    let comp = componentFromCanvasEl(editor, e.target as Element);
    if (!comp) return;
    // A right-click inside the currently selected element (e.g. an ancestor
    // picked from the hierarchy badge) keeps working with THAT element instead
    // of jumping to the deepest element under the cursor.
    const current = editor.getSelected();
    if (current && isAncestorOrSelf(current, comp)) comp = current;
    else editor.select(comp);
    const frameEl = getFrameEl();
    const p = frameEl ? framePointToPage(frameEl, e.clientX, e.clientY) : { x: e.clientX, y: e.clientY };
    menu.open(p.x, p.y, comp, 'canvas');
  };

  const bindCanvas = (): void => {
    if (!options.canvasMenu) return;
    const doc = getFrameDoc() as FrameDoc | null;
    if (!doc || doc.__gjsCmBound) return;
    doc.__gjsCmBound = true;
    doc.addEventListener('contextmenu', onCanvasContextMenu);
    boundDocs.push(doc);
  };

  // ---- Layer Manager -----------------------------------------------------------

  // Row element -> component, filled from the `layer:render` event. Falls back
  // to walking the tree (`component.viewLayer.el`) for rows rendered before
  // the plugin was loaded.
  const rows = new WeakMap<Element, Component>();
  const onLayerRender = ({ component, el }: { component: Component; el: Element }): void => {
    if (component && el) rows.set(el, component);
  };

  const componentFromLayerTarget = (target: Element): Component | undefined => {
    for (let node: Element | null = target; node; node = node.parentElement) {
      const comp = rows.get(node);
      if (comp) return comp;
    }
    const ppfx = editor.getConfig().stylePrefix || 'gjs-';
    const row = target.closest(`.${ppfx}layer`);
    const wrapper = editor.getWrapper();
    return row && wrapper ? findByLayerEl(wrapper, row) : undefined;
  };

  const onDocumentContextMenu = (e: MouseEvent): void => {
    if (!isEditorAlive(editor)) return destroy();
    if (!options.layersMenu) return;
    const target = e.target as Element | null;
    if (!target || !target.closest) return;
    const comp = componentFromLayerTarget(target);
    if (!comp) return;
    e.preventDefault();
    editor.select(comp);
    menu.open(e.clientX, e.clientY, comp, 'layers');
  };

  // ---- Wiring --------------------------------------------------------------------

  editor.on('layer:render', onLayerRender);
  // The canvas iframe is rebuilt on some actions (device change, page switch).
  editor.on('canvas:frame:load', bindCanvas);
  if (badge) editor.on('component:toggled', badge.start);

  editor.onReady(() => {
    if (destroyed) return;
    bindCanvas();
    document.addEventListener('contextmenu', onDocumentContextMenu);
    badge?.start();
  });

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    menu.destroy();
    badge?.destroy();
    document.removeEventListener('contextmenu', onDocumentContextMenu);
    boundDocs.forEach((d) => {
      d.removeEventListener('contextmenu', onCanvasContextMenu);
      delete d.__gjsCmBound;
    });
    boundDocs.length = 0;
    if (isEditorAlive(editor)) {
      // Plugin torn down by hand (api.destroy()) on a live editor.
      editor.off('layer:render', onLayerRender);
      editor.off('canvas:frame:load', bindCanvas);
      if (badge) editor.off('component:toggled', badge.start);
      editor.off('destroy', destroy);
    }
  }
  // Newer GrapesJS versions emit `destroy`; 0.21 doesn't (see isEditorAlive).
  editor.on('destroy', destroy);

  const api: ContextMenuApi = {
    open: (x, y, component, source = 'canvas') => menu.open(x, y, component, source),
    close: () => menu.close(),
    get isOpen() {
      return menu.isOpen;
    },
    destroy,
  };
  (editor as unknown as Record<string, ContextMenuApi>)[API_KEY] = api;
}

export { contextMenuPlugin };
export default contextMenuPlugin;
