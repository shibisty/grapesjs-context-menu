import type { Component, Editor } from 'grapesjs';
import { PFX } from './styles';
import { getFrameGeometry, placeInViewport } from './utils/dom';
import { componentHint, componentName, getParent, isEditorAlive } from './utils/components';

export interface HierarchyBadgeDeps {
  /** Tooltip text of the badge. */
  title: () => string;
  getFrameEl: () => HTMLIFrameElement | null;
  /** Called before the list opens (the plugin closes the context menu there). */
  beforeOpen?: () => void;
  /** Called when the loop notices the editor was destroyed. */
  onEditorDestroyed?: () => void;
}

/**
 * A clickable "Name ▾" pill over the selected element (where GrapesJS shows
 * its own name badge). Clicking it lists the element and all its ancestors
 * up to the wrapper; picking one selects it, so the context menu then works
 * with that level.
 *
 * It's a plain fixed-position element in the host page, positioned from the
 * element's getBoundingClientRect() on every animation frame while something
 * is selected: that follows canvas scroll, zoom, resize and device changes
 * without depending on canvas internals.
 */
export class HierarchyBadge {
  private badgeEl: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private raf = 0;
  /** Last applied position/name, to avoid touching the DOM on every frame. */
  private lastKey = '';
  private listDocs: Document[] = [];

  constructor(
    private readonly editor: Editor,
    private readonly deps: HierarchyBadgeDeps
  ) {}

  private getFrameEl(): HTMLIFrameElement | null {
    return this.deps.getFrameEl();
  }

  get element(): HTMLElement | null {
    return this.badgeEl;
  }

  get listElement(): HTMLElement | null {
    return this.listEl;
  }

  /** Starts following the selection (safe to call repeatedly). */
  start = (): void => {
    if (this.raf || !isEditorAlive(this.editor)) return;
    if (this.editor.getSelected()) this.raf = requestAnimationFrame(this.tick);
  };

  destroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.closeList();
    this.badgeEl?.remove();
    this.badgeEl = null;
    this.lastKey = '';
  }

  private tick = (): void => {
    this.raf = 0;
    if (!isEditorAlive(this.editor)) {
      this.destroy();
      this.deps.onEditorDestroyed?.();
      return;
    }
    this.update();
    this.raf = this.editor.getSelected() ? requestAnimationFrame(this.tick) : 0;
    if (!this.raf) {
      this.hide();
      this.closeList();
    }
  };

  private ensureBadge(): HTMLElement {
    if (this.badgeEl) return this.badgeEl;
    const el = document.createElement('div');
    el.className = `${PFX}-crumb`;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-haspopup', 'true');
    const name = document.createElement('span');
    name.className = `${PFX}-crumb-name`;
    const arrow = document.createElement('span');
    arrow.textContent = '▾';
    el.appendChild(name);
    el.appendChild(arrow);
    // Don't let the press reach the canvas or steal focus from the RTE.
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.listEl) this.closeList();
      else this.openList();
    });
    document.body.appendChild(el);
    this.badgeEl = el;
    return el;
  }

  hide(): void {
    if (this.badgeEl && this.lastKey !== 'hidden') {
      this.badgeEl.style.display = 'none';
      this.lastKey = 'hidden';
    }
  }

  /** Repositions the badge over the selected element (one frame of the loop). */
  update(): void {
    const comp = this.editor.getSelected();
    const frameEl = this.getFrameEl();
    const el = comp?.getEl?.();
    let previewing = false;
    try {
      previewing = this.editor.Commands.isActive('preview');
    } catch {
      previewing = false;
    }
    if (!comp || !frameEl || !el || !el.isConnected || previewing) return this.hide();

    const { rect: fr, scale } = getFrameGeometry(frameEl);
    const r = el.getBoundingClientRect();
    const left = fr.left + r.left * scale;
    const top = fr.top + r.top * scale;
    const right = left + r.width * scale;
    const bottom = top + r.height * scale;
    // Selected element scrolled completely out of the visible canvas.
    if (bottom < fr.top || top > fr.bottom || right < fr.left || left > fr.right) return this.hide();

    const badge = this.ensureBadge();
    const name = componentName(comp);
    const nameEl = badge.firstChild as HTMLElement;
    if (nameEl.textContent !== name) nameEl.textContent = name;
    badge.title = this.deps.title();
    badge.style.display = 'flex';
    const h = badge.offsetHeight || 20;
    const w = badge.offsetWidth || 60;
    let y = top - h;
    if (y < fr.top) y = Math.min(top, fr.bottom - h); // no room above -> sit inside the top edge
    const x = Math.max(fr.left, Math.min(left, fr.right - w));
    const key = `${Math.round(x)}:${Math.round(y)}:${name}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      badge.style.left = `${x}px`;
      badge.style.top = `${y}px`;
    }
  }

  /** The selected component followed by every selectable ancestor. */
  getChain(): Component[] {
    const chain: Component[] = [];
    for (let c = this.editor.getSelected(); c; c = getParent(c)) {
      if (c.get('selectable') !== false) chain.push(c);
    }
    return chain;
  }

  openList(): void {
    const sel = this.editor.getSelected();
    if (!sel) return;
    this.deps.beforeOpen?.();
    this.closeList();

    const list = document.createElement('div');
    list.className = `${PFX}-crumbmenu`;
    list.setAttribute('role', 'menu');
    this.getChain().forEach((comp) => {
      const isCurrent = comp === sel;
      const row = document.createElement('div');
      row.className = `${PFX}-item${isCurrent ? ` ${PFX}-item--current` : ''}`;
      row.setAttribute('role', 'menuitem');
      const name = document.createElement('span');
      name.textContent = `${isCurrent ? '● ' : '↑ '}${componentName(comp)}`;
      const hint = document.createElement('small');
      hint.textContent = componentHint(comp);
      row.appendChild(name);
      row.appendChild(hint);
      if (!isCurrent) {
        row.addEventListener('click', () => {
          this.closeList();
          this.editor.select(comp);
        });
      }
      list.appendChild(row);
    });
    document.body.appendChild(list);
    this.listEl = list;

    const r = (this.badgeEl || list).getBoundingClientRect();
    placeInViewport(list, r.left, r.bottom);

    const docs = [document];
    const frameDoc = this.getFrameEl()?.contentDocument;
    if (frameDoc && frameDoc !== document) docs.push(frameDoc);
    docs.forEach((d) => {
      d.addEventListener('mousedown', this.onOutside, true);
      d.addEventListener('keydown', this.onKeydown, true);
    });
    this.listDocs = docs;
  }

  closeList(): void {
    this.listDocs.forEach((d) => {
      d.removeEventListener('mousedown', this.onOutside, true);
      d.removeEventListener('keydown', this.onKeydown, true);
    });
    this.listDocs = [];
    if (this.listEl) {
      this.listEl.remove();
      this.listEl = null;
    }
  }

  private onOutside = (e: Event): void => {
    if (!isEditorAlive(this.editor)) return this.destroy();
    const target = e.target as Node | null;
    if (target && this.listEl?.contains(target)) return;
    if (target && this.badgeEl?.contains(target)) return;
    this.closeList();
  };

  private onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.closeList();
  };
}
