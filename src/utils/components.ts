import type { Component, Editor } from 'grapesjs';

export function getParent(comp: Component): Component | undefined {
  return comp.parent ? comp.parent() : undefined;
}

/** First child that can be selected (text nodes and `selectable: false` are skipped). */
export function firstSelectableChild(comp: Component): Component | undefined {
  return comp
    .components()
    .find((c: Component) => c.get('selectable') !== false && c.get('type') !== 'textnode');
}

export function isAncestorOrSelf(ancestor: Component, comp: Component | undefined): boolean {
  for (let c: Component | undefined = comp; c; c = getParent(c)) {
    if (c === ancestor) return true;
  }
  return false;
}

/** Human readable component name, as the Layer Manager shows it. */
export function componentName(comp: Component): string {
  return (comp.getName && comp.getName()) || comp.get('name') || comp.get('type') || 'Component';
}

/** `tag.firstClass` hint shown next to the name in the hierarchy list. */
export function componentHint(comp: Component): string {
  const tag = comp.get('tagName') || '';
  const cls = comp.getClasses ? comp.getClasses()[0] : '';
  return tag + (cls ? `.${cls}` : '');
}

/** Everything a component allows / forbids for the menu actions. */
export interface ComponentCapabilities {
  parent?: Component;
  child?: Component;
  index: number;
  siblingsCount: number;
  canAddInside: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDrag: boolean;
  canClone: boolean;
  canRemove: boolean;
}

export function getCapabilities(comp: Component): ComponentCapabilities {
  const parent = getParent(comp);
  const siblings = parent ? parent.components() : null;
  const index = siblings ? siblings.indexOf(comp) : -1;
  const siblingsCount = siblings ? siblings.length : 0;
  const draggable = comp.get('draggable') !== false;
  return {
    parent,
    child: firstSelectableChild(comp),
    index,
    siblingsCount,
    canAddInside: comp.get('droppable') !== false,
    canMoveUp: !!parent && draggable && index > 0,
    canMoveDown: !!parent && draggable && index >= 0 && index < siblingsCount - 1,
    canDrag: !!parent && draggable,
    canClone: !!parent && comp.get('copyable') !== false,
    canRemove: !!parent && comp.get('removable') !== false,
  };
}

/**
 * Moves a component one position up (`-1`) or down (`+1`) among its
 * siblings and keeps it selected. Returns `false` when it can't move.
 */
export function moveAmongSiblings(editor: Editor, comp: Component, dir: -1 | 1): boolean {
  const parent = getParent(comp);
  if (!parent) return false;
  const coll = parent.components();
  const from = coll.indexOf(comp);
  if (from < 0 || from + dir < 0 || from + dir >= coll.length) return false;
  if (typeof comp.move === 'function') {
    // Component#move() takes the drop index as the Sorter computes it: counted
    // BEFORE the component is taken out, i.e. "insert before the item at `at`".
    // Moving down by one therefore means "before the item two positions below".
    // (Passing `from + 1` is a silent no-op: move() treats it as the same spot.)
    comp.move(parent, { at: dir < 0 ? from - 1 : from + 2 });
  } else {
    // Older GrapesJS without move(): remove, then insert at the final index.
    coll.remove(comp, { temporary: true } as Record<string, unknown>);
    coll.add(comp, { at: from + dir });
  }
  editor.select(comp);
  return true;
}

/**
 * `false` once `editor.destroy()` ran. GrapesJS 0.21 doesn't emit a
 * `destroy` event, so long-lived loops/listeners check this themselves.
 */
export function isEditorAlive(editor: Editor): boolean {
  const em = editor.getModel ? (editor.getModel() as unknown as { destroyed?: boolean }) : undefined;
  return !!em && !em.destroyed;
}

/** Finds the component whose view element is `el` (depth-first). */
export function findByEl(root: Component, el: Element): Component | undefined {
  if (root.getEl && root.getEl() === el) return root;
  const kids = root.components ? root.components() : null;
  if (!kids) return undefined;
  for (const c of kids.models) {
    const found = findByEl(c, el);
    if (found) return found;
  }
  return undefined;
}

type ViewedElement = Element & { __gjsv?: { model?: Component } };

/**
 * Component under a node of the canvas iframe: the closest element that
 * GrapesJS attached a view to (`el.__gjsv`, set by every ComponentView),
 * falling back to a tree walk; the wrapper if nothing matched.
 */
export function componentFromCanvasEl(editor: Editor, el: Element | null): Component | undefined {
  const wrapper = editor.getWrapper ? editor.getWrapper() : undefined;
  for (let node: Element | null = el; node; node = node.parentElement) {
    const view = (node as ViewedElement).__gjsv;
    if (view && view.model) return view.model;
    const found = wrapper && findByEl(wrapper, node);
    if (found) return found;
  }
  return wrapper || undefined;
}

type LayeredComponent = Component & { viewLayer?: { el?: Element } };

/** Finds the component whose Layer Manager row element is `rowEl`. */
export function findByLayerEl(root: Component, rowEl: Element): Component | undefined {
  if ((root as LayeredComponent).viewLayer?.el === rowEl) return root;
  for (const c of root.components().models) {
    const found = findByLayerEl(c, rowEl);
    if (found) return found;
  }
  return undefined;
}
