import { afterEach, describe, expect, it } from 'vitest';
import type { Editor } from 'grapesjs';
import plugin, { EVENTS, getContextMenu, locales } from '../src/index';
import { STYLE_ID } from '../src/styles';
import { createEditor, destroyEditor, frameDoc, menu, rightClick, type Setup } from './helpers/editor';

const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

describe('plugin lifecycle', () => {
  let s: Setup;
  let editor: Editor | undefined;
  afterEach(() => destroyEditor(editor));

  it('exports the plugin as default plus helpers', () => {
    expect(typeof plugin).toBe('function');
    expect(EVENTS.open).toBe('context-menu:open');
    expect(Object.keys(locales)).toContain('en');
  });

  it('injects its CSS once, even with several editors', async () => {
    s = await createEditor();
    editor = s.editor;
    plugin(editor, {});
    expect(document.querySelectorAll(`#${STYLE_ID}`).length).toBe(1);
    expect(document.getElementById(STYLE_ID)!.textContent).toContain('.gjs-cm-menu');
  });

  it('injectCss: false injects nothing', async () => {
    s = await createEditor({ injectCss: false });
    editor = s.editor;
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });

  it('registers its i18n messages in the editor', async () => {
    s = await createEditor();
    editor = s.editor;
    expect(editor.I18n.t('contextMenu.delete', { l: 'ru' })).toBe('Удалить');
    expect(editor.I18n.t('contextMenu.delete', { l: 'en' })).toBe('Delete');
  });

  it('works when applied after the editor is already loaded', async () => {
    s = await createEditor({}, false);
    editor = s.editor;
    plugin(editor, {});
    rightClick(frameDoc(editor).getElementById('p1')!);
    expect(menu()).toBeTruthy();
  });

  it('exposes an API on the editor', async () => {
    s = await createEditor();
    editor = s.editor;
    const api = getContextMenu(editor)!;
    expect(api).toBeTruthy();
    api.open(10, 20, s.get('p1'));
    expect(api.isOpen).toBe(true);
    expect(menu()!.style.top).toBe('20px');
    api.close();
    expect(api.isOpen).toBe(false);
    expect(menu()).toBeNull();
  });

  it('api.destroy() removes every listener and element', async () => {
    s = await createEditor();
    editor = s.editor;
    editor.select(s.get('p1'));
    await nextFrame();
    await nextFrame();
    expect(document.querySelector('.gjs-cm-crumb')).toBeTruthy();
    getContextMenu(editor)!.destroy();
    expect(document.querySelector('.gjs-cm-crumb')).toBeNull();
    const ev = rightClick(frameDoc(editor).getElementById('p2')!);
    expect(ev.defaultPrevented).toBe(false);
    expect(menu()).toBeNull();
  });

  it('cleans itself up after editor.destroy() (GrapesJS 0.21 emits no destroy event)', async () => {
    s = await createEditor();
    editor = s.editor;
    editor.select(s.get('p1'));
    await nextFrame();
    await nextFrame();
    getContextMenu(editor)!.open(5, 5, s.get('p1'));
    const layersRow = s.layersEl.querySelector('.gjs-layer')!;
    await new Promise((r) => setTimeout(r, 10));
    editor.destroy();
    const dead = editor;
    editor = undefined;
    // the badge loop notices on its next frame; the menu on the next outside click
    await nextFrame();
    await nextFrame();
    expect(document.querySelector('.gjs-cm-crumb')).toBeNull();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menu()).toBeNull();
    // a right-click on a stale row does not throw and does not open anything
    expect(() => rightClick(layersRow)).not.toThrow();
    expect(menu()).toBeNull();
    expect(dead).toBeTruthy();
  });
});
