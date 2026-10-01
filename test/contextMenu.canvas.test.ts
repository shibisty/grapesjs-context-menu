import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Component, Editor } from 'grapesjs';
import {
  click,
  createEditor,
  destroyEditor,
  frameDoc,
  isDisabled,
  key,
  menu,
  menuItem,
  mousedown,
  rightClick,
  tick,
  type Setup,
} from './helpers/editor';
import type { ContextMenuOptions } from '../src/types';

describe('context menu in the canvas', () => {
  let s: Setup;
  let editor: Editor;
  afterEach(() => destroyEditor(editor));

  async function setup(opts: ContextMenuOptions = {}): Promise<void> {
    s = await createEditor(opts);
    editor = s.editor;
    editor.I18n.setLocale('en');
  }

  const canvasEl = (id: string): Element => frameDoc(editor).getElementById(id)!;
  const ids = (): string[] => s.get('box').components().map((c: Component) => c.getId());

  it('right-click opens the menu, selects the element and prevents the native menu', async () => {
    await setup();
    const ev = rightClick(canvasEl('p1'));
    expect(ev.defaultPrevented).toBe(true);
    expect(menu()).toBeTruthy();
    expect(editor.getSelected()).toBe(s.get('p1'));
  });

  it('renders the default items in order, with localized labels', async () => {
    await setup();
    rightClick(canvasEl('p1'));
    const actions = Array.from(menu()!.querySelectorAll('[data-action]')).map((el) => el.getAttribute('data-action'));
    // "styles" is hidden: the command isn't registered in this editor
    expect(actions).toEqual(['add', 'parent', 'child', 'up', 'down', 'move', 'clone', 'delete']);
    expect(menuItem('delete').textContent).toContain('Delete');
    expect(menuItem('delete').classList.contains('gjs-cm-item--danger')).toBe(true);
    expect(menu()!.getAttribute('role')).toBe('menu');
  });

  it('uses the Russian labels when the editor locale is ru', async () => {
    await setup();
    editor.I18n.setLocale('ru');
    rightClick(canvasEl('p1'));
    expect(menuItem('parent').textContent).toContain('Выбрать родителя');
  });

  it('keeps working with the selected ancestor when right-clicking inside it', async () => {
    await setup();
    editor.select(s.get('box'));
    rightClick(canvasEl('p2'));
    expect(editor.getSelected()).toBe(s.get('box'));
    menuItem('parent').click();
    expect(editor.getSelected()).toBe(s.get('sec'));
  });

  it('jumps to the clicked element when it is outside the current selection', async () => {
    await setup();
    editor.select(s.get('p1'));
    rightClick(canvasEl('p3'));
    expect(editor.getSelected()).toBe(s.get('p3'));
  });

  it('disables impossible actions', async () => {
    await setup();
    rightClick(canvasEl('title'));
    expect(isDisabled('up')).toBe(true);
    expect(isDisabled('down')).toBe(false);
    expect(isDisabled('child')).toBe(true); // only a text node inside
    expect(isDisabled('parent')).toBe(false);
  });

  it('a disabled item does nothing and keeps the menu open', async () => {
    await setup();
    rightClick(canvasEl('title'));
    menuItem('up').click();
    expect(menu()).toBeTruthy();
    expect(ids()).toEqual(['title', 'p1', 'p2', 'p3']);
  });

  it('select parent / select child', async () => {
    await setup();
    rightClick(canvasEl('p1'));
    menuItem('parent').click();
    expect(editor.getSelected()).toBe(s.get('box'));
    expect(menu()).toBeNull();
    rightClick(canvasEl('box'));
    menuItem('child').click();
    expect(editor.getSelected()).toBe(s.get('title'));
  });

  it('move up / move down reorder siblings', async () => {
    await setup();
    rightClick(canvasEl('p2'));
    menuItem('up').click();
    expect(ids()).toEqual(['title', 'p2', 'p1', 'p3']);
    rightClick(canvasEl('p2'));
    menuItem('down').click();
    expect(ids()).toEqual(['title', 'p1', 'p2', 'p3']);
    rightClick(canvasEl('p2'));
    menuItem('down').click();
    expect(ids()).toEqual(['title', 'p1', 'p3', 'p2']);
    expect(editor.getSelected()).toBe(s.get('p2'));
  });

  it('duplicate runs tlb-clone on the component', async () => {
    await setup();
    const spy = vi.spyOn(editor, 'runCommand');
    rightClick(canvasEl('p1'));
    menuItem('clone').click();
    expect(spy).toHaveBeenCalledWith('tlb-clone');
    expect(s.get('box').components().length).toBe(5);
  });

  it('move starts tlb-move with the component as target', async () => {
    await setup();
    const spy = vi.spyOn(editor, 'runCommand').mockImplementation(() => undefined);
    rightClick(canvasEl('p1'));
    menuItem('move').click();
    expect(spy).toHaveBeenCalledWith('tlb-move', expect.objectContaining({ target: s.get('p1') }));
  });

  it('delete removes the component', async () => {
    await setup();
    rightClick(canvasEl('p1'));
    menuItem('delete').click();
    expect(ids()).toEqual(['title', 'p2', 'p3']);
  });

  it('delete is disabled for removable: false', async () => {
    await setup();
    s.get('p1').set('removable', false);
    rightClick(canvasEl('p1'));
    expect(isDisabled('delete')).toBe(true);
  });

  it('"View styles" appears only when the command exists, and runs it', async () => {
    await setup();
    const run = vi.fn();
    editor.Commands.add('layers-sidebar:show-styles', { run });
    rightClick(canvasEl('p1'));
    menuItem('styles').click();
    expect(run).toHaveBeenCalledTimes(1);
    expect(editor.getSelected()).toBe(s.get('p1'));
  });

  it('"View styles" uses a custom command and can be disabled with null', async () => {
    await setup({ viewStylesCommand: 'my:styles' });
    const run = vi.fn();
    editor.Commands.add('my:styles', { run });
    rightClick(canvasEl('p1'));
    menuItem('styles').click();
    expect(run).toHaveBeenCalled();
    await destroyEditor(editor);

    await setup({ viewStylesCommand: null });
    editor.Commands.add('layers-sidebar:show-styles', { run });
    rightClick(canvasEl('p1'));
    expect(menu()!.querySelector('[data-action="styles"]')).toBeNull();
  });

  it('labels option overrides the text', async () => {
    await setup({ labels: { delete: 'Remove it' } });
    rightClick(canvasEl('p1'));
    expect(menuItem('delete').textContent).toContain('Remove it');
  });

  it('labels are inserted as text, not HTML', async () => {
    await setup({ labels: { delete: '<img src=x onerror=alert(1)>' } });
    rightClick(canvasEl('p1'));
    expect(menuItem('delete').querySelector('img')).toBeNull();
    expect(menuItem('delete').textContent).toContain('<img');
  });

  describe('closing', () => {
    it('closes on mousedown outside (host page and canvas)', async () => {
      await setup();
      rightClick(canvasEl('p1'));
      await tick();
      mousedown(menu()!); // inside: stays open
      expect(menu()).toBeTruthy();
      mousedown(document.body);
      expect(menu()).toBeNull();

      rightClick(canvasEl('p1'));
      await tick();
      mousedown(canvasEl('p2'));
      expect(menu()).toBeNull();
    });

    it('closes on Escape', async () => {
      await setup();
      rightClick(canvasEl('p1'));
      await tick();
      key(document, 'Escape');
      expect(menu()).toBeNull();
    });

    it('a second right-click replaces the menu instead of stacking', async () => {
      await setup();
      rightClick(canvasEl('p1'));
      rightClick(canvasEl('p3'));
      expect(document.querySelectorAll('.gjs-cm-menu').length).toBe(1);
    });

    it('closes on canvas wheel', async () => {
      await setup();
      rightClick(canvasEl('p1'));
      await tick();
      frameDoc(editor).dispatchEvent(new Event('wheel'));
      expect(menu()).toBeNull();
    });
  });

  describe('keyboard', () => {
    it('arrows move focus over ENABLED items (wrapping), Enter activates', async () => {
      await setup();
      rightClick(canvasEl('p2'));
      await tick();
      // a text component is droppable: false -> "Add element" is disabled and skipped
      expect(isDisabled('add')).toBe(true);
      key(document, 'ArrowDown');
      expect((document.activeElement as HTMLElement).dataset.action).toBe('parent');
      key(document, 'ArrowUp'); // wraps to the last item
      expect((document.activeElement as HTMLElement).dataset.action).toBe('delete');
      key(document, 'ArrowUp');
      expect((document.activeElement as HTMLElement).dataset.action).toBe('clone');
      key(document, 'Enter');
      expect(ids().length).toBe(5);
      expect(menu()).toBeNull();
    });

    it('ArrowRight opens the add submenu, ArrowLeft/Escape close only the submenu', async () => {
      await setup();
      editor.Blocks.add('b1', { label: 'B1', content: '<b>1</b>' });
      rightClick(canvasEl('box'));
      await tick();
      key(document, 'ArrowDown');
      key(document, 'ArrowRight');
      expect(document.querySelector('.gjs-cm-submenu')).toBeTruthy();
      expect((document.activeElement as HTMLElement).dataset.blockId).toBe('b1');
      key(document, 'ArrowLeft');
      expect(document.querySelector('.gjs-cm-submenu')).toBeNull();
      expect(menu()).toBeTruthy();
      menuItem('add').click();
      key(document, 'Escape');
      expect(document.querySelector('.gjs-cm-submenu')).toBeNull();
      expect(menu()).toBeTruthy();
    });
  });

  describe('"Add element" submenu', () => {
    async function withBlocks(opts: ContextMenuOptions = {}): Promise<void> {
      await setup(opts);
      editor.Blocks.add('b-text', { label: 'Text', category: 'Basic', content: '<p class="added">Hi</p>' });
      editor.Blocks.add('b-img', { label: '<svg></svg> Image', category: 'Media', content: { type: 'image' } });
      editor.Blocks.add('b-link', { label: 'Link', category: 'Basic', content: '<a class="added-link">x</a>' });
    }

    it('lists blocks grouped by category', async () => {
      await withBlocks();
      rightClick(canvasEl('box'));
      menuItem('add').click();
      const sub = document.querySelector('.gjs-cm-submenu')!;
      expect(Array.from(sub.querySelectorAll('.gjs-cm-group')).map((g) => g.textContent)).toEqual(['Basic', 'Media']);
      expect(Array.from(sub.querySelectorAll('[data-block-id]')).map((r) => r.textContent)).toEqual(['Text', 'Link', 'Image']);
      expect(menuItem('add').classList.contains('gjs-cm-item--open')).toBe(true);
    });

    it('clicking a block appends it INTO the target and selects it', async () => {
      await withBlocks();
      const onAction = vi.fn();
      editor.on('context-menu:action', onAction);
      rightClick(canvasEl('box'));
      menuItem('add').click();
      click(document.querySelector('[data-block-id="b-text"]')!);
      const box = s.get('box');
      const last = box.components().at(box.components().length - 1);
      expect(last.getClasses()).toContain('added');
      expect(editor.getSelected()).toBe(last);
      expect(menu()).toBeNull();
      expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'add', component: box, added: last, block: 'b-text' }));
    });

    it('respects the blocks option', async () => {
      await withBlocks({ blocks: ['b-link'] });
      rightClick(canvasEl('box'));
      menuItem('add').click();
      const rows = document.querySelectorAll('.gjs-cm-submenu [data-block-id]');
      expect(Array.from(rows).map((r) => r.getAttribute('data-block-id'))).toEqual(['b-link']);
    });

    it('shows a placeholder when there are no blocks', async () => {
      await withBlocks({ blocks: [] });
      rightClick(canvasEl('box'));
      menuItem('add').click();
      expect(document.querySelector('.gjs-cm-submenu .gjs-cm-item--empty')!.textContent).toBe('No blocks available');
    });

    it('is disabled for droppable: false', async () => {
      await withBlocks();
      s.get('box').set('droppable', false);
      rightClick(canvasEl('box'));
      expect(isDisabled('add')).toBe(true);
      menuItem('add').click();
      expect(document.querySelector('.gjs-cm-submenu')).toBeNull();
    });

    it('clicking inside the submenu does not close the menu', async () => {
      await withBlocks();
      rightClick(canvasEl('box'));
      await tick();
      menuItem('add').click();
      mousedown(document.querySelector('.gjs-cm-submenu')!);
      expect(menu()).toBeTruthy();
    });
  });

  describe('extendMenu and events', () => {
    it('custom items run with the menu context', async () => {
      const run = vi.fn();
      await setup({
        extendMenu: (items) => [
          ...items.filter((i) => i.id !== 'move'),
          { id: 'log', label: 'Log it', icon: '★', separator: true, run },
        ],
      });
      rightClick(canvasEl('p1'));
      expect(menu()!.querySelector('[data-action="move"]')).toBeNull();
      menuItem('log').click();
      expect(run).toHaveBeenCalledWith(expect.objectContaining({ component: s.get('p1'), source: 'canvas', editor }));
      expect(menu()).toBeNull();
    });

    it('emits open / action / close events', async () => {
      await setup();
      const events: string[] = [];
      ['context-menu:open', 'context-menu:action', 'context-menu:close'].forEach((ev) =>
        editor.on(ev, (payload: { id?: string }) => events.push(ev + (payload?.id ? `:${payload.id}` : '')))
      );
      rightClick(canvasEl('p1'));
      menuItem('parent').click();
      expect(events).toEqual(['context-menu:open', 'context-menu:close', 'context-menu:action:parent']);
    });
  });

  it('canvasMenu: false leaves the native menu alone', async () => {
    await setup({ canvasMenu: false });
    const ev = rightClick(canvasEl('p1'));
    expect(ev.defaultPrevented).toBe(false);
    expect(menu()).toBeNull();
  });

  it('positions the menu inside the viewport', async () => {
    await setup();
    rightClick(canvasEl('p1'), 50, 60);
    const m = menu()!;
    expect(m.style.left).toBe('50px');
    expect(m.style.top).toBe('60px');
  });
});
