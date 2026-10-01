import { afterEach, describe, expect, it } from 'vitest';
import type { Component, Editor } from 'grapesjs';
import { createEditor, destroyEditor, menu, menuItem, rightClick, type Setup } from './helpers/editor';
import type { ContextMenuOptions } from '../src/types';

describe('context menu in the Layer Manager', () => {
  let s: Setup;
  let editor: Editor;
  afterEach(() => destroyEditor(editor));

  async function setup(opts: ContextMenuOptions = {}): Promise<void> {
    s = await createEditor(opts);
    editor = s.editor;
    editor.I18n.setLocale('en');
    // expand the tree so every row is rendered
    editor.Layers.setOpen(s.get('sec'), true);
    editor.Layers.setOpen(s.get('box'), true);
  }

  const row = (c: Component): HTMLElement => {
    const el = (c as unknown as { viewLayer?: { el: HTMLElement } }).viewLayer?.el;
    if (!el) throw new Error('row not rendered');
    return el;
  };

  it('right-click on a row opens the menu for that component and selects it', async () => {
    await setup();
    const title = row(s.get('p2')).querySelector('.gjs-layer-name') || row(s.get('p2'));
    const ev = rightClick(title, 120, 80);
    expect(ev.defaultPrevented).toBe(true);
    expect(menu()).toBeTruthy();
    expect(editor.getSelected()).toBe(s.get('p2'));
    expect(menu()!.style.left).toBe('120px');
    expect(menu()!.style.top).toBe('80px');
  });

  it('actions apply to the row component', async () => {
    await setup();
    rightClick(row(s.get('p3')));
    menuItem('up').click();
    expect(s.get('box').components().map((c: Component) => c.getId())).toEqual(['title', 'p1', 'p3', 'p2']);
  });

  it('reports source "layers" to custom items', async () => {
    let source = '';
    await setup({
      extendMenu: (items) => [...items, { id: 'x', label: 'X', run: (ctx) => (source = ctx.source) }],
    });
    rightClick(row(s.get('p1')));
    menuItem('x').click();
    expect(source).toBe('layers');
  });

  it('works for rows rendered before the plugin was loaded (viewLayer fallback)', async () => {
    s = await createEditor({}, false);
    editor = s.editor;
    editor.Layers.setOpen(s.get('sec'), true);
    editor.Layers.setOpen(s.get('box'), true);
    const { default: plugin } = await import('../src/index');
    plugin(editor, {});
    rightClick(row(s.get('p1')));
    expect(menu()).toBeTruthy();
    expect(editor.getSelected()).toBe(s.get('p1'));
  });

  it('ignores right-clicks outside layer rows', async () => {
    await setup();
    const other = document.createElement('div');
    document.body.appendChild(other);
    const ev = rightClick(other);
    expect(ev.defaultPrevented).toBe(false);
    expect(menu()).toBeNull();
  });

  it('layersMenu: false leaves the native menu alone', async () => {
    await setup({ layersMenu: false });
    const ev = rightClick(row(s.get('p1')));
    expect(ev.defaultPrevented).toBe(false);
    expect(menu()).toBeNull();
  });
});
