import { afterEach, describe, expect, it } from 'vitest';
import type { Editor } from 'grapesjs';
import { click, createEditor, destroyEditor, frameDoc, menu, mousedown, rightClick, tick, type Setup } from './helpers/editor';
import type { ContextMenuOptions } from '../src/types';

const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

describe('hierarchy badge', () => {
  let s: Setup;
  let editor: Editor;
  afterEach(() => destroyEditor(editor));

  async function setup(opts: ContextMenuOptions = {}): Promise<void> {
    s = await createEditor(opts);
    editor = s.editor;
    editor.I18n.setLocale('en');
  }

  const badge = (): HTMLElement | null => document.querySelector('.gjs-cm-crumb');
  const list = (): HTMLElement | null => document.querySelector('.gjs-cm-crumbmenu');

  it('appears over the selected element with its name', async () => {
    await setup();
    s.get('box').set('name', 'Box');
    editor.select(s.get('box'));
    await nextFrame();
    await nextFrame();
    expect(badge()).toBeTruthy();
    expect(badge()!.style.display).toBe('flex');
    expect(badge()!.textContent).toContain('Box');
    expect(badge()!.title).toBe('Hierarchy: choose which element to work with');
  });

  it('follows the selection and hides when nothing is selected', async () => {
    await setup();
    s.get('p1').set('name', 'First');
    s.get('p2').set('name', 'Second');
    editor.select(s.get('p1'));
    await nextFrame();
    await nextFrame();
    expect(badge()!.textContent).toContain('First');
    editor.select(s.get('p2'));
    await nextFrame();
    expect(badge()!.textContent).toContain('Second');
    editor.select(undefined as never);
    await nextFrame();
    await nextFrame();
    expect(badge()!.style.display).toBe('none');
  });

  it('hides in preview mode', async () => {
    await setup();
    editor.select(s.get('p1'));
    await nextFrame();
    await nextFrame();
    editor.runCommand('preview');
    await nextFrame();
    expect(badge()!.style.display).toBe('none');
  });

  it('lists the element and its ancestors; picking one selects it', async () => {
    await setup();
    editor.select(s.get('p2'));
    await nextFrame();
    await nextFrame();
    click(badge()!);
    const rows = Array.from(list()!.querySelectorAll('.gjs-cm-item'));
    // p2, box, section, wrapper(body)
    expect(rows.length).toBe(4);
    expect(rows[0].classList.contains('gjs-cm-item--current')).toBe(true);
    expect(rows[0].textContent).toContain('●');
    expect(rows[1].querySelector('small')!.textContent).toBe('div.box');
    click(rows[2]);
    expect(editor.getSelected()).toBe(s.get('sec'));
    expect(list()).toBeNull();
  });

  it('skips non-selectable ancestors', async () => {
    await setup();
    s.get('box').set('selectable', false);
    editor.select(s.get('p2'));
    await nextFrame();
    await nextFrame();
    click(badge()!);
    const hints = Array.from(list()!.querySelectorAll('small')).map((el) => el.textContent);
    expect(hints).not.toContain('div.box');
    expect(hints).toContain('section');
  });

  it('clicking the badge again, clicking outside or Escape closes the list', async () => {
    await setup();
    editor.select(s.get('p2'));
    await nextFrame();
    await nextFrame();
    click(badge()!);
    click(badge()!);
    expect(list()).toBeNull();

    click(badge()!);
    mousedown(list()!);
    expect(list()).toBeTruthy();
    mousedown(document.body);
    expect(list()).toBeNull();

    click(badge()!);
    mousedown(frameDoc(editor).body);
    expect(list()).toBeNull();

    click(badge()!);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(list()).toBeNull();
  });

  it('opening the list closes an open context menu', async () => {
    await setup();
    editor.select(s.get('p2'));
    await nextFrame();
    await nextFrame();
    rightClick(frameDoc(editor).getElementById('p2')!);
    await tick();
    expect(menu()).toBeTruthy();
    click(badge()!);
    expect(menu()).toBeNull();
    expect(list()).toBeTruthy();
  });

  it('mousedown on the badge does not reach the canvas', async () => {
    await setup();
    editor.select(s.get('p2'));
    await nextFrame();
    await nextFrame();
    const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    badge()!.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('hierarchyBadge: false renders nothing', async () => {
    await setup({ hierarchyBadge: false });
    editor.select(s.get('p2'));
    await nextFrame();
    await nextFrame();
    expect(badge()).toBeNull();
  });
});
