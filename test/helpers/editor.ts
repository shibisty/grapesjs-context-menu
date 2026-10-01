import grapesjs, { type Component, type Editor } from 'grapesjs';
import contextMenuPlugin from '../../src/index';
import type { ContextMenuOptions } from '../../src/types';

export const SAMPLE_HTML = `
  <section id="sec">
    <div id="box" class="box">
      <h1 id="title">Title</h1>
      <p id="p1">One</p>
      <p id="p2">Two</p>
      <p id="p3">Three</p>
    </div>
  </section>`;

export interface Setup {
  editor: Editor;
  get(id: string): Component;
  layersEl: HTMLElement;
}

/**
 * A real grapesjs editor in jsdom, with the plugin loaded and the Layer
 * Manager rendered into its own container (like `layerManager.appendTo`).
 */
export async function createEditor(opts: ContextMenuOptions = {}, withPlugin = true): Promise<Setup> {
  const container = document.createElement('div');
  container.id = 'gjs';
  const layersEl = document.createElement('div');
  layersEl.id = 'layers';
  document.body.append(container, layersEl);

  const editor = grapesjs.init({
    container,
    height: '600px',
    storageManager: false,
    telemetry: false,
    panels: { defaults: [] },
    layerManager: { appendTo: '#layers' },
    components: SAMPLE_HTML,
    plugins: withPlugin ? [(ed: Editor) => contextMenuPlugin(ed, opts)] : [],
  } as Parameters<typeof grapesjs.init>[0]);

  await new Promise<void>((resolve) => editor.onReady(() => resolve()));

  const get = (id: string): Component => {
    const found = editor.getWrapper()!.find(`#${id}`)[0];
    if (!found) throw new Error(`no component #${id}`);
    return found;
  };
  return { editor, get, layersEl };
}

export async function destroyEditor(editor: Editor | undefined): Promise<void> {
  if (!editor) return;
  // Let GrapesJS' own debounced handlers (selection, layers) run before the
  // teardown, otherwise they fire on a destroyed editor and throw.
  await new Promise((r) => setTimeout(r, 10));
  try {
    editor.destroy();
  } catch {
    /* ignore teardown noise from jsdom */
  }
  document.body.innerHTML = '';
}

export function frameDoc(editor: Editor): Document {
  const doc = editor.Canvas.getFrameEl().contentDocument;
  if (!doc) throw new Error('no frame document');
  return doc;
}

export function rightClick(target: Element, x = 10, y = 10): MouseEvent {
  const view = target.ownerDocument.defaultView as Window & typeof globalThis;
  const ev = new view.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 });
  target.dispatchEvent(ev);
  return ev;
}

export function click(target: Element): void {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

export function mousedown(target: Element): void {
  const view = target.ownerDocument.defaultView as Window & typeof globalThis;
  target.dispatchEvent(new view.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}

export function key(target: Document | Element, k: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
}

/** Lets the menu attach its deferred outside-click listeners. */
export const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

export function menu(): HTMLElement | null {
  return document.querySelector('.gjs-cm-menu');
}

export function menuItem(action: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`.gjs-cm-menu [data-action="${action}"]`);
  if (!el) throw new Error(`no menu item ${action}`);
  return el;
}

export function isDisabled(action: string): boolean {
  return menuItem(action).classList.contains('gjs-cm-item--disabled');
}
