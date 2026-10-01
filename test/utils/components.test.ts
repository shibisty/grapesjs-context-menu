import { afterEach, describe, expect, it } from 'vitest';
import type { Component, Editor } from 'grapesjs';
import {
  componentFromCanvasEl,
  componentHint,
  componentName,
  findByLayerEl,
  firstSelectableChild,
  getCapabilities,
  isAncestorOrSelf,
  moveAmongSiblings,
} from '../../src/utils/components';
import { createEditor, destroyEditor, frameDoc, type Setup } from '../helpers/editor';

describe('component helpers', () => {
  let s: Setup;
  let editor: Editor;
  afterEach(() => destroyEditor(editor));

  const ids = (): string[] =>
    s.get('box').components().map((c: Component) => c.getId());

  it('getCapabilities: first / middle / last child', async () => {
    s = await createEditor();
    editor = s.editor;
    const first = getCapabilities(s.get('title'));
    expect(first.canMoveUp).toBe(false);
    expect(first.canMoveDown).toBe(true);
    const last = getCapabilities(s.get('p3'));
    expect(last.canMoveUp).toBe(true);
    expect(last.canMoveDown).toBe(false);
    const mid = getCapabilities(s.get('p1'));
    expect(mid.parent).toBe(s.get('box'));
    expect(mid.index).toBe(1);
    expect(mid.siblingsCount).toBe(4);
    expect(mid.canClone && mid.canRemove && mid.canDrag).toBe(true);
  });

  it('getCapabilities: wrapper has no parent, so nothing structural is allowed', async () => {
    s = await createEditor();
    editor = s.editor;
    const cap = getCapabilities(editor.getWrapper()!);
    expect(cap.parent).toBeUndefined();
    expect(cap.canMoveUp || cap.canMoveDown || cap.canDrag || cap.canClone || cap.canRemove).toBe(false);
    expect(cap.canAddInside).toBe(true);
    expect(cap.child).toBe(s.get('sec'));
  });

  it('getCapabilities respects draggable / copyable / removable / droppable flags', async () => {
    s = await createEditor();
    editor = s.editor;
    const p1 = s.get('p1');
    p1.set({ draggable: false, copyable: false, removable: false, droppable: false });
    const cap = getCapabilities(p1);
    expect(cap.canMoveUp || cap.canMoveDown || cap.canDrag).toBe(false);
    expect(cap.canClone).toBe(false);
    expect(cap.canRemove).toBe(false);
    expect(cap.canAddInside).toBe(false);
  });

  it('firstSelectableChild skips text nodes and non-selectable children', async () => {
    s = await createEditor();
    editor = s.editor;
    s.get('title').set('selectable', false);
    expect(firstSelectableChild(s.get('box'))).toBe(s.get('p1'));
    // <p>One</p> contains only a text node
    expect(firstSelectableChild(s.get('p1'))).toBeUndefined();
  });

  it('moveAmongSiblings moves up/down, selects, and stops at the edges', async () => {
    s = await createEditor();
    editor = s.editor;
    expect(moveAmongSiblings(editor, s.get('p2'), -1)).toBe(true);
    expect(ids()).toEqual(['title', 'p2', 'p1', 'p3']);
    expect(editor.getSelected()).toBe(s.get('p2'));
    expect(moveAmongSiblings(editor, s.get('p2'), 1)).toBe(true);
    expect(moveAmongSiblings(editor, s.get('p2'), 1)).toBe(true);
    expect(ids()).toEqual(['title', 'p1', 'p3', 'p2']);
    expect(moveAmongSiblings(editor, s.get('p2'), 1)).toBe(false);
    expect(moveAmongSiblings(editor, s.get('title'), -1)).toBe(false);
    expect(moveAmongSiblings(editor, editor.getWrapper()!, 1)).toBe(false);
  });

  it('isAncestorOrSelf', async () => {
    s = await createEditor();
    editor = s.editor;
    expect(isAncestorOrSelf(s.get('sec'), s.get('p1'))).toBe(true);
    expect(isAncestorOrSelf(s.get('p1'), s.get('p1'))).toBe(true);
    expect(isAncestorOrSelf(s.get('p1'), s.get('sec'))).toBe(false);
    expect(isAncestorOrSelf(s.get('p1'), undefined)).toBe(false);
  });

  it('componentName / componentHint', async () => {
    s = await createEditor();
    editor = s.editor;
    const box = s.get('box');
    expect(typeof componentName(box)).toBe('string');
    expect(componentName(box).length).toBeGreaterThan(0);
    box.set('name', 'My box');
    expect(componentName(box)).toBe('My box');
    expect(componentHint(box)).toBe('div.box');
    expect(componentHint(s.get('p1'))).toBe('p');
  });

  it('componentFromCanvasEl maps canvas nodes (and their inner nodes) to components', async () => {
    s = await createEditor();
    editor = s.editor;
    const doc = frameDoc(editor);
    expect(componentFromCanvasEl(editor, doc.getElementById('p2'))).toBe(s.get('p2'));
    const textNodeParent = doc.getElementById('title')!.firstChild!.parentElement;
    expect(componentFromCanvasEl(editor, textNodeParent)).toBe(s.get('title'));
    expect(componentFromCanvasEl(editor, null)).toBe(editor.getWrapper());
  });

  it('findByLayerEl maps a Layer Manager row to its component', async () => {
    s = await createEditor();
    editor = s.editor;
    // open every level so all rows are rendered
    editor.Layers.setOpen(s.get('sec'), true);
    editor.Layers.setOpen(s.get('box'), true);
    const p2 = s.get('p2');
    const row = (p2 as unknown as { viewLayer?: { el: Element } }).viewLayer?.el;
    expect(row).toBeTruthy();
    expect(findByLayerEl(editor.getWrapper()!, row!)).toBe(p2);
    expect(findByLayerEl(editor.getWrapper()!, document.body)).toBeUndefined();
  });
});
