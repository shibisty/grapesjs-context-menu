import type { Component, Editor } from 'grapesjs';

/**
 * The parts of the grapesjs-fonts API (`editor.Fonts`, 0.2+) the menu
 * uses. Typed here, so there is no dependency on that package: without it
 * the "Font" item is simply not shown.
 */
export interface FontsLike {
  list(): Array<{ family: string; category?: string }>;
  /** To the current Style Manager target. */
  apply(family: string, target?: unknown): boolean;
  applyToRange?(family: string, range: Range): boolean;
  clear?(target?: unknown): boolean;
  valueOf(family: string): string;
  fromValue?(value: string | null | undefined): { family: string } | undefined;
  open?(options?: { family?: string; onApply?: (font: { family: string }, value: string) => void }): void;
}

export function getFontsApi(editor: Editor): FontsLike | null {
  const api = (editor as unknown as { Fonts?: FontsLike }).Fonts;
  return api && typeof api.list === 'function' && typeof api.apply === 'function' && typeof api.valueOf === 'function'
    ? api
    : null;
}

/** First family of a `font-family` value, unquoted: `'Open Sans', sans-serif` -> `Open Sans`. */
export function firstFamily(value: string | null | undefined): string {
  if (!value) return '';
  const first = String(value).split(',')[0] || '';
  return first.trim().replace(/^['"]|['"]$/g, '').trim();
}

/**
 * The text the user selected inside a component in the canvas (a copy of
 * the range), or null when nothing is selected there.
 */
export function selectedTextRange(doc: Document | null | undefined, component: Component): Range | null {
  try {
    const sel = doc?.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (range.collapsed || !range.toString().trim()) return null;
    const el = component.getEl();
    if (!el || !el.contains(range.commonAncestorContainer)) return null;
    return range.cloneRange();
  } catch {
    return null;
  }
}

/** The style target "Font" applies to (what the Style Manager edits for the component). */
export function styleTarget(editor: Editor, component: Component): { getStyle?: () => Record<string, unknown> } {
  try {
    const sm = (editor as unknown as { StyleManager?: { getSelected?: () => unknown } }).StyleManager;
    const target = sm?.getSelected?.() as { getStyle?: () => Record<string, unknown> } | undefined;
    if (target && editor.getSelected() === component) return target;
  } catch {
    /* no Style Manager */
  }
  return component as unknown as { getStyle?: () => Record<string, unknown> };
}

/** The font family set on the target, or the computed one of the range start. */
export function currentFamily(editor: Editor, component: Component, range: Range | null): string {
  if (range) {
    let node: Node | null = range.startContainer;
    if (node && node.nodeType !== 1) node = node.parentNode;
    const el = node as Element | null;
    const win = el?.ownerDocument?.defaultView;
    try {
      return el && win ? firstFamily(win.getComputedStyle(el).fontFamily) : '';
    } catch {
      return '';
    }
  }
  const style = styleTarget(editor, component).getStyle?.() || {};
  return firstFamily(style['font-family'] as string | undefined);
}
