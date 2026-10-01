import type { Component, Editor } from 'grapesjs';
import type { ContextMenuLabels, MenuContext, MenuItem, ResolvedOptions } from './types';
import { PFX } from './styles';
import { placeInViewport } from './utils/dom';
import { getCapabilities, isEditorAlive, moveAmongSiblings } from './utils/components';
import { appendBlock, blockId, blockText, getAvailableBlocks, getBlockManager, groupBlocks } from './utils/blocks';

export const EVENTS = {
  open: 'context-menu:open',
  close: 'context-menu:close',
  action: 'context-menu:action',
} as const;

type Translate = (key: keyof ContextMenuLabels) => string;

/**
 * The right-click menu itself: renders into `document.body` with
 * `position: fixed`, so the caller passes viewport coordinates of the HOST
 * page (canvas coordinates must be converted first, see framePointToPage).
 */
export class ContextMenu {
  private menuEl: HTMLElement | null = null;
  private submenuEl: HTMLElement | null = null;
  private ctx: MenuContext | null = null;
  private items: MenuItem[] = [];
  /** Documents with our "click outside / Escape" listeners (host + canvas iframe). */
  private listened: Document[] = [];
  private listenTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly editor: Editor,
    private readonly options: ResolvedOptions,
    private readonly t: Translate,
    private readonly getFrameDoc: () => Document | null
  ) {}

  get isOpen(): boolean {
    return !!this.menuEl;
  }

  get element(): HTMLElement | null {
    return this.menuEl;
  }

  get submenuElement(): HTMLElement | null {
    return this.submenuEl;
  }

  /** Item list for a component (after `extendMenu`). Exposed for tests/extensions. */
  buildItems(ctx: MenuContext): MenuItem[] {
    const { editor, options, t } = this;
    const cap = getCapabilities(ctx.component);
    const stylesCmd = options.viewStylesCommand;
    const hasStyles = !!stylesCmd && editor.Commands.has(stylesCmd);
    const items: MenuItem[] = [
      { id: 'add', icon: '＋', label: t('add'), disabled: !cap.canAddInside },
      { id: 'parent', icon: '↑', label: t('selectParent'), disabled: !cap.parent, separator: true },
      { id: 'child', icon: '↓', label: t('selectChild'), disabled: !cap.child },
      { id: 'up', icon: '⇡', label: t('moveUp'), disabled: !cap.canMoveUp },
      { id: 'down', icon: '⇣', label: t('moveDown'), disabled: !cap.canMoveDown },
      { id: 'move', icon: '✥', label: t('move'), disabled: !cap.canDrag },
      { id: 'clone', icon: '⧉', label: t('clone'), disabled: !cap.canClone },
    ];
    if (hasStyles) {
      items.push({ id: 'styles', icon: '✎', label: t('viewStyles'), separator: true });
    }
    items.push({
      id: 'delete',
      icon: '🗑',
      label: t('delete'),
      disabled: !cap.canRemove,
      danger: true,
      separator: true,
    });
    return options.extendMenu ? options.extendMenu(items, ctx) || items : items;
  }

  open(x: number, y: number, component: Component, source: MenuContext['source']): void {
    this.close();
    const ctx: MenuContext = { editor: this.editor, component, source };
    this.ctx = ctx;
    this.items = this.buildItems(ctx);

    const menu = document.createElement('div');
    menu.className = `${PFX}-menu`;
    menu.setAttribute('role', 'menu');
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    this.items.forEach((item, i) => {
      if (item.separator && i > 0) menu.appendChild(this.renderSeparator());
      menu.appendChild(this.renderItem(item));
    });
    menu.addEventListener('click', this.onMenuClick);
    menu.addEventListener('contextmenu', (e) => e.preventDefault());
    document.body.appendChild(menu);
    this.menuEl = menu;
    placeInViewport(menu, x, y);

    // Deferred, so the very event that opened the menu doesn't close it again.
    this.listenTimer = setTimeout(() => this.listen(), 0);
    this.editor.trigger(EVENTS.open, { component, source });
  }

  close(): void {
    clearTimeout(this.listenTimer);
    this.unlisten();
    this.closeSubmenu();
    if (!this.menuEl) return;
    this.menuEl.remove();
    this.menuEl = null;
    const component = this.ctx?.component;
    this.ctx = null;
    this.items = [];
    this.editor.trigger(EVENTS.close, { component });
  }

  destroy(): void {
    this.close();
  }

  // ---- rendering ----------------------------------------------------------

  private renderSeparator(): HTMLElement {
    const sep = document.createElement('div');
    sep.className = `${PFX}-sep`;
    sep.setAttribute('role', 'separator');
    return sep;
  }

  private renderItem(item: MenuItem): HTMLElement {
    const el = document.createElement('div');
    el.className = `${PFX}-item`;
    if (item.danger) el.classList.add(`${PFX}-item--danger`);
    if (item.disabled) {
      el.classList.add(`${PFX}-item--disabled`);
      el.setAttribute('aria-disabled', 'true');
    }
    el.setAttribute('role', 'menuitem');
    el.setAttribute('data-action', item.id);
    el.tabIndex = -1;

    const main = document.createElement('span');
    const ico = document.createElement('i');
    ico.className = `${PFX}-ico`;
    ico.textContent = item.icon || '';
    main.appendChild(ico);
    main.appendChild(document.createTextNode(item.label));
    el.appendChild(main);

    if (item.id === 'add') {
      el.setAttribute('aria-haspopup', 'true');
      const arrow = document.createElement('span');
      arrow.textContent = '▸';
      el.appendChild(arrow);
    }
    return el;
  }

  // ---- actions --------------------------------------------------------------

  private onMenuClick = (e: MouseEvent): void => {
    const el = (e.target as Element).closest(`.${PFX}-item`);
    if (!el || el.classList.contains(`${PFX}-item--disabled`)) return;
    const id = el.getAttribute('data-action') || '';
    if (id === 'add') {
      this.openAddSubmenu(el as HTMLElement);
      return;
    }
    this.runAction(id, e);
  };

  /** Runs a menu item by id (also used by keyboard handling and tests). */
  runAction(id: string, event?: Event): void {
    const ctx = this.ctx;
    const item = this.items.find((i) => i.id === id);
    if (!ctx || !item || item.disabled) return;
    const { editor, options } = this;
    const comp = ctx.component;
    this.close();

    if (item.run) {
      item.run(ctx);
    } else {
      const cap = getCapabilities(comp);
      switch (id) {
        case 'parent':
          if (cap.parent) editor.select(cap.parent);
          break;
        case 'child':
          if (cap.child) editor.select(cap.child);
          break;
        case 'up':
          moveAmongSiblings(editor, comp, -1);
          break;
        case 'down':
          moveAmongSiblings(editor, comp, 1);
          break;
        case 'move':
          editor.select(comp);
          try {
            // Same command as the toolbar's "arrows" button. Started from a menu
            // click the mouse button is already released: move the pointer, click to drop.
            editor.runCommand('tlb-move', { target: comp, event });
          } catch (err) {
            console.warn('[grapesjs-context-menu] tlb-move failed', err);
          }
          break;
        case 'clone':
          editor.select(comp);
          editor.runCommand('tlb-clone');
          break;
        case 'styles':
          editor.select(comp);
          if (options.viewStylesCommand && editor.Commands.has(options.viewStylesCommand)) {
            editor.runCommand(options.viewStylesCommand);
          }
          break;
        case 'delete':
          comp.remove();
          break;
        default:
          return;
      }
    }
    editor.trigger(EVENTS.action, { id, component: comp, source: ctx.source });
  }

  // ---- "Add element" submenu --------------------------------------------------

  private closeSubmenu(): void {
    if (this.submenuEl) {
      this.submenuEl.remove();
      this.submenuEl = null;
    }
    this.menuEl?.querySelector(`.${PFX}-item--open`)?.classList.remove(`${PFX}-item--open`);
  }

  openAddSubmenu(anchorEl?: HTMLElement): void {
    this.closeSubmenu();
    const anchor = anchorEl || this.menuEl?.querySelector<HTMLElement>('[data-action="add"]');
    if (!anchor || !this.ctx) return;
    anchor.classList.add(`${PFX}-item--open`);

    const sub = document.createElement('div');
    sub.className = `${PFX}-submenu`;
    sub.setAttribute('role', 'menu');
    const blocks = getAvailableBlocks(this.editor, this.options.blocks);

    if (!blocks.length) {
      const empty = document.createElement('div');
      empty.className = `${PFX}-item ${PFX}-item--empty`;
      empty.textContent = this.t('noBlocks');
      sub.appendChild(empty);
    } else {
      groupBlocks(blocks).forEach((group) => {
        if (group.category) {
          const h = document.createElement('div');
          h.className = `${PFX}-group`;
          h.textContent = group.category;
          sub.appendChild(h);
        }
        group.blocks.forEach((b) => {
          const row = document.createElement('div');
          row.className = `${PFX}-item`;
          row.setAttribute('role', 'menuitem');
          row.setAttribute('data-block-id', blockId(b));
          row.tabIndex = -1;
          row.textContent = blockText(b);
          sub.appendChild(row);
        });
      });
    }

    sub.addEventListener('click', this.onSubmenuClick);
    document.body.appendChild(sub);
    this.submenuEl = sub;
    const r = anchor.getBoundingClientRect();
    placeInViewport(sub, r.right, r.top);
  }

  private onSubmenuClick = (e: MouseEvent): void => {
    const row = (e.target as Element).closest('[data-block-id]');
    if (!row) return;
    this.addBlock(row.getAttribute('data-block-id') || '');
  };

  /** Appends a block into the menu's component and selects the result. */
  addBlock(id: string): Component | undefined {
    const ctx = this.ctx;
    if (!ctx) return undefined;
    const block = getBlockManager(this.editor)?.get(id);
    let added: Component | undefined;
    if (block) {
      added = appendBlock(this.editor, block, ctx.component);
      if (added) this.editor.select(added);
    }
    this.close();
    if (added) {
      this.editor.trigger(EVENTS.action, {
        id: 'add',
        component: ctx.component,
        added,
        block: id,
        source: ctx.source,
      });
    }
    return added;
  }

  // ---- outside click / keyboard ---------------------------------------------------

  private onOutside = (e: Event): void => {
    if (!isEditorAlive(this.editor)) return this.close();
    const target = e.target as Node | null;
    if (target && this.menuEl?.contains(target)) return;
    if (target && this.submenuEl?.contains(target)) return;
    this.close();
  };

  private onKeydown = (e: KeyboardEvent): void => {
    const menu = this.menuEl;
    if (!menu) return;
    if (!isEditorAlive(this.editor)) return this.close();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.submenuEl) this.closeSubmenu();
      else this.close();
      return;
    }
    const container = this.submenuEl || menu;
    const rows = Array.from(
      container.querySelectorAll<HTMLElement>(
        `.${PFX}-item:not(.${PFX}-item--disabled):not(.${PFX}-item--empty)`
      )
    );
    if (!rows.length) return;
    const doc = container.ownerDocument;
    const current = rows.indexOf(doc.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const next = current < 0 ? (step > 0 ? 0 : rows.length - 1) : (current + step + rows.length) % rows.length;
      rows[next].focus();
    } else if (e.key === 'ArrowRight' && !this.submenuEl && rows[current]?.dataset.action === 'add') {
      e.preventDefault();
      this.openAddSubmenu(rows[current]);
      const sub = this.submenuElement; // getter: TS narrowed `this.submenuEl` to null above
      sub?.querySelector<HTMLElement>(`.${PFX}-item[data-block-id]`)?.focus();
    } else if (e.key === 'ArrowLeft' && this.submenuEl) {
      e.preventDefault();
      this.closeSubmenu();
      menu.querySelector<HTMLElement>('[data-action="add"]')?.focus();
    } else if ((e.key === 'Enter' || e.key === ' ') && current >= 0) {
      e.preventDefault();
      rows[current].click();
    }
  };

  private listen(): void {
    const docs = [document];
    const frameDoc = this.getFrameDoc();
    if (frameDoc && frameDoc !== document) docs.push(frameDoc);
    docs.forEach((d) => {
      d.addEventListener('mousedown', this.onOutside, true);
      d.addEventListener('keydown', this.onKeydown, true);
    });
    // Scrolling the canvas would leave the menu floating over the wrong element.
    frameDoc?.addEventListener('wheel', this.onFrameWheel, true);
    window.addEventListener('resize', this.onFrameWheel);
    this.listened = docs;
  }

  private onFrameWheel = (): void => this.close();

  private unlisten(): void {
    this.listened.forEach((d) => {
      d.removeEventListener('mousedown', this.onOutside, true);
      d.removeEventListener('keydown', this.onKeydown, true);
      d.removeEventListener('wheel', this.onFrameWheel, true);
    });
    window.removeEventListener('resize', this.onFrameWheel);
    this.listened = [];
  }
}
