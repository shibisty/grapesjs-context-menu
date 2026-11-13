import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Component, Editor } from 'grapesjs';
import { createEditor, destroyEditor, frameDoc, key, menu, menuItem, rightClick, tick, type Setup } from './helpers/editor';
import type { ContextMenuOptions } from '../src/types';
import { firstFamily } from '../src/utils/fonts';

/** Stand-in for the grapesjs-fonts API (`editor.Fonts`). */
function fakeFonts(families = ['Lora', 'Inter']) {
  const valueOf = (f: string) => `'${f}', serif`;
  let onApply: ((font: { family: string }, value: string) => void) | undefined;
  return {
    list: () => families.map((family) => ({ family, category: 'serif' })),
    valueOf,
    apply: vi.fn((family: string, target: { addStyle: (s: Record<string, string>) => void }) => {
      if (!families.includes(family)) return false;
      target.addStyle({ 'font-family': valueOf(family) });
      return true;
    }),
    applyToRange: vi.fn((family: string, range: Range) => families.includes(family) && !range.collapsed),
    clear: vi.fn((target: { removeStyle: (p: string) => void }) => {
      target.removeStyle('font-family');
      return true;
    }),
    open: vi.fn((o: { onApply?: typeof onApply }) => {
      onApply = o.onApply;
    }),
    pick: (family: string) => onApply?.({ family }, valueOf(family)),
  };
}

describe('"Font" item (grapesjs-fonts)', () => {
  let s: Setup;
  let editor: Editor;
  let fonts: ReturnType<typeof fakeFonts>;
  afterEach(() => destroyEditor(editor));

  async function setup(opts: ContextMenuOptions = {}, withFonts = true): Promise<void> {
    s = await createEditor(opts);
    editor = s.editor;
    editor.I18n.setLocale('en');
    fonts = fakeFonts();
    if (withFonts) (editor as unknown as { Fonts: unknown }).Fonts = fonts;
  }

  const canvasEl = (id: string): Element => frameDoc(editor).getElementById(id)!;
  const sub = (): HTMLElement | null => document.querySelector('.gjs-cm-submenu');
  const fontRows = (): HTMLElement[] => Array.from(sub()!.querySelectorAll<HTMLElement>('[data-font]'));
  const fontOf = (c: Component): string => String(c.getStyle()['font-family'] || '');

  function openFontMenu(id: string): void {
    rightClick(canvasEl(id));
    menuItem('font').click();
  }

  it('is shown only with grapesjs-fonts and fontsMenu', async () => {
    await setup({}, false);
    rightClick(canvasEl('p1'));
    expect(menu()!.querySelector('[data-action="font"]')).toBeNull();
    await destroyEditor(editor);

    await setup({ fontsMenu: false });
    rightClick(canvasEl('p1'));
    expect(menu()!.querySelector('[data-action="font"]')).toBeNull();
    await destroyEditor(editor);

    await setup();
    rightClick(canvasEl('p1'));
    expect(menuItem('font').getAttribute('aria-haspopup')).toBe('true');
  });

  it('lists the project fonts in their own face; applies to the whole element', async () => {
    await setup();
    openFontMenu('p1');
    expect(sub()!.querySelector('.gjs-cm-group')!.textContent).toBe('Whole element');
    expect(fontRows().map((r) => r.textContent)).toEqual(['Lora', 'Inter']);
    expect(fontRows()[0].style.fontFamily).toContain('Lora');
    // nothing set yet: "Default font" is disabled
    expect(sub()!.querySelector('[data-font-action="default"]')!.classList.contains('gjs-cm-item--disabled')).toBe(true);

    const action = vi.fn();
    editor.on('context-menu:action', action);
    fontRows()[0].click();
    expect(menu()).toBeNull();
    expect(firstFamily(fontOf(s.get('p1')))).toBe('Lora');
    expect(fonts.applyToRange).not.toHaveBeenCalled();
    expect(action).toHaveBeenCalledWith(expect.objectContaining({ id: 'font', family: 'Lora', selection: false, source: 'canvas' }));

    // the current font is checked, "Default font" removes it
    openFontMenu('p1');
    expect(fontRows()[0].classList.contains('gjs-cm-item--checked')).toBe(true);
    (sub()!.querySelector('[data-font-action="default"]') as HTMLElement).click();
    expect(fontOf(s.get('p1'))).toBe('');
  });

  it('applies to the text selected in the canvas', async () => {
    await setup();
    const doc = frameDoc(editor);
    const text = canvasEl('p1').firstChild!;
    const range = doc.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 2);
    doc.getSelection()!.removeAllRanges();
    doc.getSelection()!.addRange(range);
    openFontMenu('p1');
    expect(sub()!.querySelector('.gjs-cm-group')!.textContent).toBe('Selected text');
    expect(sub()!.querySelector('[data-font-action="default"]')).toBeNull();
    fontRows()[1].click();
    expect(fonts.applyToRange).toHaveBeenCalledWith('Inter', expect.anything());
    expect((fonts.applyToRange.mock.calls[0][1] as Range).toString()).toBe('On');
    expect(fonts.apply).not.toHaveBeenCalled();
  });

  it('a selection in another element does not count', async () => {
    await setup();
    const doc = frameDoc(editor);
    const range = doc.createRange();
    range.selectNodeContents(canvasEl('p2'));
    doc.getSelection()!.addRange(range);
    openFontMenu('p1');
    expect(sub()!.querySelector('.gjs-cm-group')!.textContent).toBe('Whole element');
  });

  it('"More fonts…" opens the font browser; the chosen font goes to the element', async () => {
    await setup();
    openFontMenu('p2');
    (sub()!.querySelector('[data-font-action="more"]') as HTMLElement).click();
    expect(fonts.open).toHaveBeenCalled();
    expect(menu()).toBeNull();
    fonts.pick('Inter');
    expect(firstFamily(fontOf(s.get('p2')))).toBe('Inter');
  });

  it('works from the Layer Manager', async () => {
    await setup();
    const row = s.get('p3').viewLayer?.el as HTMLElement | undefined;
    expect(row).toBeTruthy();
    rightClick(row!);
    menuItem('font').click();
    fontRows()[0].click();
    expect(firstFamily(fontOf(s.get('p3')))).toBe('Lora');
  });

  it('keyboard: → opens the submenu and focuses the first font', async () => {
    await setup();
    rightClick(canvasEl('p1'));
    await tick();
    menuItem('font').focus();
    key(document, 'ArrowRight');
    expect(sub()).toBeTruthy();
    expect(document.activeElement?.getAttribute('data-font')).toBe('Lora');
    key(document, 'ArrowLeft');
    expect(sub()).toBeNull();
    expect(document.activeElement?.getAttribute('data-action')).toBe('font');
  });

  it('shows a hint when the project has no fonts', async () => {
    await setup();
    (editor as unknown as { Fonts: unknown }).Fonts = { ...fakeFonts([]), open: undefined, clear: undefined };
    openFontMenu('p1');
    expect(sub()!.querySelector('.gjs-cm-item--empty')!.textContent).toBe('No fonts in the project');
    expect(sub()!.querySelector('.gjs-cm-sep')).toBeNull();
  });
});

describe('firstFamily', () => {
  it('unquotes the first family', () => {
    expect(firstFamily(`'Open Sans', sans-serif`)).toBe('Open Sans');
    expect(firstFamily('"Lora",serif')).toBe('Lora');
    expect(firstFamily('')).toBe('');
    expect(firstFamily(undefined)).toBe('');
  });
});
