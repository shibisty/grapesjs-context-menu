/**
 * grapesjs-layers-context-menu
 * ----------------------------
 * GrapesJS plugin: right-click context menu + hierarchy picker.
 * (Part 1 of 2. The sidebar behaviour - split Layers / Style Manager /
 * Component Settings, persistence, tab memory - lives in the separate
 * `grapesjs-layers-sidebar` plugin. The two work together but neither
 * requires the other.)
 *
 * Context menu - on right-click over a Layer Manager row AND over an
 * element in the canvas:
 *   - Добавить элемент    -> submenu with Block Manager blocks (grouped by
 *                            category); the block is appended INTO the target
 *   - Выбрать родителя / Выбрать вложенный
 *   - Переместить выше / ниже (order among siblings)
 *   - Переместить (drag, same `tlb-move` command as the toolbar)
 *   - Копировать (`tlb-clone`)
 *   - Просмотреть стили   -> runs `viewStylesCommand` (provided by the
 *                            sidebar plugin); hidden if that command does not exist
 *   - Удалить
 *
 * Hierarchy badge - a clickable "Name ▾" pill on the selected element in the
 * canvas listing its ancestors up to <body>. Picking one selects it, and the
 * context menu then works with that level.
 *
 * Usage (a GrapesJS plugin is a plain function (editor, opts) => {...};
 * there is no `editor.use()`):
 *   grapesjsLayersContextMenu(editor, { ...options });
 *   // or: grapesjs.init({ plugins: [grapesjsLayersContextMenu], ... })
 *
 * Options: blocks, injectCss, canvasMenu, hierarchyBadge, viewStylesCommand, labels
 * Uses `layerManager.appendTo` from your editor config to find the layers panel.
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? (module.exports = factory())
    : typeof define === 'function' && define.amd
    ? define(factory)
    : ((global = typeof globalThis !== 'undefined' ? globalThis : global || self),
      (global.grapesjsLayersContextMenu = factory()));
})(this, function () {
  'use strict';

  var DEFAULTS = {
    // Restrict the "add element" submenu to specific block ids (null = all blocks).
    blocks: null,
    injectCss: true,
    // Also show the same context menu on right-click inside the canvas.
    canvasMenu: true,
    // Clickable "Name ▾" badge on the selected element with its ancestors.
    hierarchyBadge: true,
    // Command run by "Просмотреть стили". Registered by grapesjs-layers-sidebar.
    viewStylesCommand: 'layers-sidebar:show-styles',
    labels: {
      delete: 'Удалить',
      add: 'Добавить элемент',
      viewStyles: 'Просмотреть стили',
      noBlocks: 'Нет доступных блоков',
      selectParent: 'Выбрать родителя',
      selectChild: 'Выбрать вложенный',
      moveUp: 'Переместить выше',
      moveDown: 'Переместить ниже',
      move: 'Переместить (перетаскивание)',
      clone: 'Копировать',
      hierarchyTitle: 'Иерархия: выберите, с каким элементом работать',
    },
  };

  function mergeDeep(base, extra) {
    var out = Object.assign({}, base);
    if (extra) {
      Object.keys(extra).forEach(function (k) {
        if (
          extra[k] &&
          typeof extra[k] === 'object' &&
          !Array.isArray(extra[k]) &&
          base[k] &&
          typeof base[k] === 'object'
        ) {
          out[k] = mergeDeep(base[k], extra[k]);
        } else {
          out[k] = extra[k];
        }
      });
    }
    return out;
  }

  var CSS =
    '.gjs-lcm-menu,.gjs-lcm-submenu{position:fixed;z-index:99999;min-width:190px;background:#333;color:#ddd;border:1px solid rgba(255,255,255,.12);border-radius:4px;box-shadow:0 4px 14px rgba(0,0,0,.35);padding:4px 0;font-size:13px;font-family:inherit;}' +
    '.gjs-lcm-menu-item{padding:7px 14px;cursor:pointer;white-space:nowrap;display:flex;justify-content:space-between;align-items:center;gap:10px;}' +
    '.gjs-lcm-menu-item:hover{background:#3b97e3;color:#fff;}' +
    '.gjs-lcm-menu-item--danger{color:#ff7a7a;}' +
    '.gjs-lcm-menu-item--danger:hover{background:#c33;color:#fff;}' +
    '.gjs-lcm-menu-item--empty,.gjs-lcm-menu-item--disabled{opacity:.45;cursor:default;}' +
    '.gjs-lcm-menu-item--empty:hover,.gjs-lcm-menu-item--disabled:hover{background:transparent;color:inherit;}' +
    '.gjs-lcm-submenu{max-height:min(70vh,520px);overflow-y:auto;}' +
    '.gjs-lcm-menu-group{padding:6px 14px 3px;font-size:10px;letter-spacing:.06em;text-transform:uppercase;opacity:.55;}' +
    '.gjs-lcm-menu-ico{display:inline-block;width:16px;margin-right:8px;text-align:center;opacity:.8;font-style:normal;}' +
    '.gjs-lcm-menu-item small{opacity:.6;margin-left:10px;font-size:11px;}' +
    '.gjs-lcm-menu-item--current{font-weight:600;cursor:default;}' +
    '.gjs-lcm-crumb{position:fixed;z-index:100;display:none;align-items:center;gap:5px;padding:0 8px;height:20px;font-size:12px;line-height:20px;background:#3b97e3;color:#fff;border-radius:3px 3px 0 0;cursor:pointer;user-select:none;white-space:nowrap;}' +
    '.gjs-lcm-crumb:hover{background:#2f86d0;}' +
    '.gjs-lcm-crumbmenu{position:fixed;z-index:99998;min-width:220px;max-height:60vh;overflow-y:auto;background:#333;color:#ddd;border:1px solid rgba(255,255,255,.12);border-radius:4px;box-shadow:0 4px 14px rgba(0,0,0,.35);padding:4px 0;font-size:13px;}' +
    '.gjs-lcm-menu-sep{height:1px;margin:4px 0;background:rgba(255,255,255,.1);}';

  function injectCss() {
    if (document.getElementById('gjs-lcm-styles')) return;
    var style = document.createElement('style');
    style.id = 'gjs-lcm-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function resolveEl(target) {
    if (!target) return null;
    return typeof target === 'string' ? document.querySelector(target) : target;
  }

  function clampToViewport(el, x, y) {
    // Measure after appending (so offsetWidth/Height are real), then clamp.
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var w = el.offsetWidth;
    var h = el.offsetHeight;
    var left = x;
    var top = y;
    if (left + w > vw) left = Math.max(0, vw - w - 4);
    if (top + h > vh) top = Math.max(0, vh - h - 4);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  function plugin(editor, opts) {
    var options = mergeDeep(DEFAULTS, opts || {});
    if (options.injectCss) injectCss();

    var menuEl = null;
    var submenuEl = null;
    var targetComponent = null;
    var listenedDocs = []; // extra documents (canvas iframe) we listen on while a menu is open

    function closeMenus() {
      if (menuEl) {
        menuEl.remove();
        menuEl = null;
      }
      if (submenuEl) {
        submenuEl.remove();
        submenuEl = null;
      }
      document.removeEventListener('mousedown', onDocClick, true);
      document.removeEventListener('keydown', onKeydown, true);
      listenedDocs.forEach(function (d) {
        d.removeEventListener('mousedown', onDocClick, true);
        d.removeEventListener('keydown', onKeydown, true);
        d.removeEventListener('wheel', closeMenus, true);
      });
      listenedDocs = [];
    }

    function onDocClick(e) {
      if (menuEl && menuEl.contains(e.target)) return;
      if (submenuEl && submenuEl.contains(e.target)) return;
      closeMenus();
    }

    function onKeydown(e) {
      if (e.key === 'Escape') closeMenus();
    }

    // ---- Layers <-> Component ------------------------------------------------

    function getLayersRoot() {
      var cfg = editor.Layers.getConfig();
      return resolveEl(cfg.appendTo);
    }

    function getComponentFromRow(rowEl) {
      // The Layer Manager doesn't expose a public "DOM node -> Component"
      // lookup, but clicking a layer's title is exactly how GrapesJS itself
      // resolves that mapping (it selects the matching component). We reuse
      // that native behaviour: simulate the click, then read the selection.
      var titleEl = rowEl.querySelector('.gjs-layer-title') || rowEl;
      titleEl.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
      );
      return editor.getSelected();
    }

    // ---- Context menu -----------------------------------------------------

    function openContextMenu(x, y, component) {
      closeMenus();
      targetComponent = component;

      menuEl = document.createElement('div');
      menuEl.className = 'gjs-lcm-menu';
      menuEl.style.left = x + 'px';
      menuEl.style.top = y + 'px';
      var L = options.labels;
      var parent = component.parent && component.parent();
      var siblings = parent ? parent.components() : null;
      var idx = siblings ? siblings.indexOf(component) : -1;
      var child = firstSelectableChild(component);
      var noRemove = component.get('removable') === false;
      // "view styles" is provided by the sidebar plugin (or any command you name)
      var hasStyles = !!(options.viewStylesCommand && editor.Commands.has(options.viewStylesCommand));
      function item(action, icon, label, disabled, extra) {
        return (
          '<div class="gjs-lcm-menu-item' +
          (extra ? ' ' + extra : '') +
          (disabled ? ' gjs-lcm-menu-item--disabled' : '') +
          '" data-action="' +
          action +
          '"><span><i class="gjs-lcm-menu-ico">' +
          icon +
          '</i>' +
          label +
          '</span></div>'
        );
      }
      menuEl.innerHTML =
        '<div class="gjs-lcm-menu-item' +
        (component.get('droppable') === false ? ' gjs-lcm-menu-item--disabled' : '') +
        '" data-action="add"><span><i class="gjs-lcm-menu-ico">＋</i>' +
        L.add +
        '</span><span>▸</span></div>' +
        '<div class="gjs-lcm-menu-sep"></div>' +
        item('parent', '↑', L.selectParent, !parent) +
        item('child', '↓', L.selectChild, !child) +
        item('up', '⇡', L.moveUp, !parent || idx <= 0 || component.get('draggable') === false) +
        item(
          'down',
          '⇣',
          L.moveDown,
          !parent || idx < 0 || idx >= siblings.length - 1 || component.get('draggable') === false
        ) +
        item('move', '✥', L.move, !parent || component.get('draggable') === false) +
        item('clone', '⧉', L.clone, !parent || component.get('copyable') === false) +
        (hasStyles
          ? '<div class="gjs-lcm-menu-sep"></div>' + item('styles', '✎', L.viewStyles, false)
          : '') +
        '<div class="gjs-lcm-menu-sep"></div>' +
        item('delete', '🗑', L.delete, noRemove, 'gjs-lcm-menu-item--danger');
      document.body.appendChild(menuEl);
      clampToViewport(menuEl, x, y);

      menuEl.addEventListener('click', function (e) {
        var el = e.target.closest('.gjs-lcm-menu-item');
        if (!el || el.classList.contains('gjs-lcm-menu-item--disabled')) return;
        var action = el.getAttribute('data-action');
        var comp = targetComponent;
        if (!comp) return;
        if (action === 'add') {
          openAddSubmenu(el);
          return;
        }
        closeMenus();
        if (action === 'delete') {
          comp.remove();
        } else if (action === 'styles') {
          editor.select(comp);
          if (hasStyles) editor.runCommand(options.viewStylesCommand);
          editor.trigger('layers-menu:view-styles', comp);
        } else if (action === 'parent') {
          parent && editor.select(parent);
        } else if (action === 'child') {
          child && editor.select(child);
        } else if (action === 'up' || action === 'down') {
          moveAmongSiblings(comp, action === 'up' ? -1 : 1);
        } else if (action === 'move') {
          editor.select(comp);
          try {
            // Same command as the toolbar's arrows button. Started from a menu click,
            // the mouse button is already released: move the pointer, click to drop.
            editor.runCommand('tlb-move', { target: comp, event: e });
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[grapesjs-layers-context-menu] tlb-move failed', err);
          }
        } else if (action === 'clone') {
          editor.select(comp);
          editor.runCommand('tlb-clone');
        }
      });

      setTimeout(function () {
        document.addEventListener('mousedown', onDocClick, true);
        document.addEventListener('keydown', onKeydown, true);
        // clicks inside the canvas iframe never reach the parent document
        var frameDoc = getFrameDoc();
        if (frameDoc) {
          listenedDocs.push(frameDoc);
          frameDoc.addEventListener('mousedown', onDocClick, true);
          frameDoc.addEventListener('keydown', onKeydown, true);
          frameDoc.addEventListener('wheel', closeMenus, true);
        }
      }, 0);
    }

    function blockText(b) {
      var id = b.get ? b.get('id') || b.id : b.id;
      var label = b.get ? b.get('label') : '';
      var tmp = document.createElement('div');
      tmp.innerHTML = label || '';
      tmp.querySelectorAll('svg,style,script').forEach(function (n) {
        n.remove();
      });
      var text = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
      return text || String(id);
    }

    function blockCategory(b) {
      var c = b.get ? b.get('category') : null;
      if (!c) return '';
      if (typeof c === 'string') return c;
      return (c.get ? c.get('label') || c.get('id') : c.label || c.id) || '';
    }

    function openAddSubmenu(anchorEl) {
      if (submenuEl) {
        submenuEl.remove();
        submenuEl = null;
      }

      var all = editor.Blocks ? editor.Blocks.getAll() : editor.BlockManager.getAll();
      var models = all && all.models ? all.models : Array.isArray(all) ? all : [];
      var filtered = options.blocks
        ? models.filter(function (b) {
            return options.blocks.indexOf(b.get ? b.get('id') || b.id : b.id) !== -1;
          })
        : models;

      submenuEl = document.createElement('div');
      submenuEl.className = 'gjs-lcm-submenu';

      if (!filtered.length) {
        var empty = document.createElement('div');
        empty.className = 'gjs-lcm-menu-item gjs-lcm-menu-item--empty';
        empty.textContent = options.labels.noBlocks;
        submenuEl.appendChild(empty);
      } else {
        // group by category, keep first-seen order
        var order = [];
        var groups = {};
        filtered.forEach(function (b) {
          var cat = blockCategory(b);
          if (!groups[cat]) {
            groups[cat] = [];
            order.push(cat);
          }
          groups[cat].push(b);
        });
        order.forEach(function (cat) {
          if (cat) {
            var h = document.createElement('div');
            h.className = 'gjs-lcm-menu-group';
            h.textContent = cat;
            submenuEl.appendChild(h);
          }
          groups[cat].forEach(function (b) {
            var item = document.createElement('div');
            item.className = 'gjs-lcm-menu-item';
            item.setAttribute('data-block-id', b.get ? b.get('id') || b.id : b.id);
            item.textContent = blockText(b);
            submenuEl.appendChild(item);
          });
        });
      }
      document.body.appendChild(submenuEl);
      var r = anchorEl.getBoundingClientRect();
      submenuEl.style.left = r.right + 'px';
      submenuEl.style.top = r.top + 'px';
      clampToViewport(submenuEl, r.right, r.top);

      submenuEl.addEventListener('click', function (e) {
        var item = e.target.closest('[data-block-id]');
        if (!item || !targetComponent) return;
        var block = (editor.Blocks || editor.BlockManager).get(item.getAttribute('data-block-id'));
        if (block) {
          var content = block.get('content');
          // some plugins (e.g. countdown, tabs) define content as a function
          if (typeof content === 'function') content = content(editor);
          var added = targetComponent.append(content);
          var addedComp = Array.isArray(added) ? added[0] : added;
          if (addedComp) editor.select(addedComp);
        }
        closeMenus();
      });
    }

    // ---- Structure helpers ----------------------------------------------------

    function firstSelectableChild(comp) {
      var found = null;
      comp.components().forEach(function (c) {
        if (!found && c.get('selectable') !== false && c.get('type') !== 'textnode') found = c;
      });
      return found;
    }

    function moveAmongSiblings(comp, dir) {
      var parent = comp.parent();
      if (!parent) return;
      var coll = parent.components();
      var at = coll.indexOf(comp) + dir; // index AFTER the component is taken out
      if (at < 0 || at >= coll.length) return;
      if (typeof comp.move === 'function') {
        comp.move(parent, { at: at });
      } else {
        coll.remove(comp, { temporary: true });
        coll.add(comp, { at: at });
      }
      editor.select(comp);
    }

    function isAncestorOrSelf(anc, comp) {
      for (var c = comp; c; c = c.parent && c.parent()) {
        if (c === anc) return true;
      }
      return false;
    }

    function compName(c) {
      return (c.getName && c.getName()) || c.get('name') || c.get('type') || 'Component';
    }

    function compHint(c) {
      var tag = c.get('tagName') || '';
      var cls = c.getClasses ? c.getClasses()[0] : '';
      return tag + (cls ? '.' + cls : '');
    }

    // ---- Hierarchy badge on the selected element ---------------------------------
    // A clickable "Name ▾" pill sitting where GrapesJS shows its own name tag.
    // It is a plain fixed-position element positioned from the element's
    // getBoundingClientRect() (so no dependency on canvas internals).

    var crumbEl = null;
    var crumbMenuEl = null;
    var crumbRaf = 0;
    var crumbLast = '';

    function ensureCrumb() {
      if (crumbEl) return crumbEl;
      crumbEl = document.createElement('div');
      crumbEl.className = 'gjs-lcm-crumb';
      crumbEl.title = options.labels.hierarchyTitle;
      crumbEl.innerHTML = '<span class="gjs-lcm-crumb-name"></span><span>▾</span>';
      // don't let the click reach the canvas / steal focus from the RTE
      crumbEl.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();
      });
      crumbEl.addEventListener('click', function (e) {
        e.stopPropagation();
        if (crumbMenuEl) closeCrumbMenu();
        else openCrumbMenu();
      });
      document.body.appendChild(crumbEl);
      return crumbEl;
    }

    function hideCrumb() {
      if (crumbEl && crumbLast !== 'hidden') {
        crumbEl.style.display = 'none';
        crumbLast = 'hidden';
      }
    }

    function updateCrumb() {
      var comp = editor.getSelected();
      var frameEl = null;
      try {
        frameEl = editor.Canvas.getFrameEl();
      } catch (e) {}
      var el = comp && comp.getEl && comp.getEl();
      var previewing = false;
      try {
        previewing = editor.Commands.isActive('preview');
      } catch (e) {}
      if (!comp || !frameEl || !el || !el.isConnected || previewing) return hideCrumb();

      var fr = frameEl.getBoundingClientRect();
      var scale = frameEl.offsetWidth ? fr.width / frameEl.offsetWidth : 1;
      var r = el.getBoundingClientRect();
      var left = fr.left + r.left * scale;
      var top = fr.top + r.top * scale;
      var right = left + r.width * scale;
      var bottom = top + r.height * scale;
      // selected element scrolled completely out of the visible canvas
      if (bottom < fr.top || top > fr.bottom || right < fr.left || left > fr.right) return hideCrumb();

      var c = ensureCrumb();
      var name = compName(comp);
      var nameEl = c.firstChild;
      if (nameEl.textContent !== name) nameEl.textContent = name;
      c.style.display = 'flex';
      var h = c.offsetHeight || 20;
      var w = c.offsetWidth || 60;
      var y = top - h;
      if (y < fr.top) y = Math.min(top, fr.bottom - h); // no room above -> sit inside the top edge
      var x = Math.max(fr.left, Math.min(left, fr.right - w));
      var key = Math.round(x) + ':' + Math.round(y) + ':' + name;
      if (key !== crumbLast) {
        crumbLast = key;
        c.style.left = x + 'px';
        c.style.top = y + 'px';
      }
    }

    function crumbTick() {
      updateCrumb();
      crumbRaf = editor.getSelected() ? requestAnimationFrame(crumbTick) : 0;
      if (!crumbRaf) {
        hideCrumb();
        closeCrumbMenu();
      }
    }

    function startCrumb() {
      if (!options.hierarchyBadge || crumbRaf) return;
      if (editor.getSelected()) crumbRaf = requestAnimationFrame(crumbTick);
    }

    function closeCrumbMenu() {
      if (crumbMenuEl) {
        crumbMenuEl.remove();
        crumbMenuEl = null;
      }
      document.removeEventListener('mousedown', onCrumbOutside, true);
      var fd = getFrameDoc();
      if (fd) fd.removeEventListener('mousedown', onCrumbOutside, true);
    }

    function onCrumbOutside(e) {
      if (crumbMenuEl && crumbMenuEl.contains(e.target)) return;
      if (crumbEl && crumbEl.contains(e.target)) return;
      closeCrumbMenu();
    }

    function openCrumbMenu() {
      var sel = editor.getSelected();
      if (!sel) return;
      closeMenus();
      closeCrumbMenu();
      crumbMenuEl = document.createElement('div');
      crumbMenuEl.className = 'gjs-lcm-crumbmenu';
      // the selected element first, then every ancestor up to the body
      for (var c = sel; c; c = c.parent && c.parent()) {
        (function (comp) {
          if (comp.get('selectable') === false) return;
          var isCurrent = comp === sel;
          var row = document.createElement('div');
          row.className = 'gjs-lcm-menu-item' + (isCurrent ? ' gjs-lcm-menu-item--current' : '');
          var name = document.createElement('span');
          name.textContent = (isCurrent ? '● ' : '↑ ') + compName(comp);
          var hint = document.createElement('small');
          hint.textContent = compHint(comp);
          row.appendChild(name);
          row.appendChild(hint);
          if (!isCurrent) {
            row.addEventListener('click', function () {
              closeCrumbMenu();
              editor.select(comp);
            });
          }
          crumbMenuEl.appendChild(row);
        })(c);
      }
      document.body.appendChild(crumbMenuEl);
      var r = crumbEl.getBoundingClientRect();
      crumbMenuEl.style.left = r.left + 'px';
      crumbMenuEl.style.top = r.bottom + 'px';
      clampToViewport(crumbMenuEl, r.left, r.bottom);
      document.addEventListener('mousedown', onCrumbOutside, true);
      var fd = getFrameDoc();
      if (fd) fd.addEventListener('mousedown', onCrumbOutside, true);
    }

    // ---- Canvas (iframe) right-click ----------------------------------------

    function getFrameDoc() {
      try {
        var f = editor.Canvas.getFrameEl();
        return f && f.contentDocument;
      } catch (e) {
        return null;
      }
    }

    function findByEl(comp, el) {
      if (comp.getEl && comp.getEl() === el) return comp;
      var kids = comp.components ? comp.components() : null;
      if (!kids) return null;
      var found = null;
      kids.forEach(function (c) {
        if (!found) found = findByEl(c, el);
      });
      return found;
    }

    function getComponentFromCanvasEl(el) {
      var wrapper = editor.getWrapper && editor.getWrapper();
      for (var node = el; node; node = node.parentElement) {
        var view = node.__gjsv;
        if (view && view.model) return view.model;
        var c = wrapper && findByEl(wrapper, node);
        if (c) return c;
      }
      return wrapper || null;
    }

    function bindCanvasMenu() {
      if (!options.canvasMenu) return;
      var doc = getFrameDoc();
      if (!doc || doc.__lcmBound) return;
      doc.__lcmBound = true;
      doc.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        var comp = getComponentFromCanvasEl(e.target);
        if (!comp) return;
        // If the right-click lands inside the currently selected element (e.g. the
        // ancestor picked from the hierarchy badge), keep working with THAT one
        // instead of jumping to the deepest element under the cursor.
        var current = editor.getSelected();
        if (current && isAncestorOrSelf(current, comp)) comp = current;
        else editor.select(comp);
        // iframe coords -> page coords (respects canvas zoom)
        var frameEl = editor.Canvas.getFrameEl();
        var r = frameEl.getBoundingClientRect();
        var scale = frameEl.offsetWidth ? r.width / frameEl.offsetWidth : 1;
        openContextMenu(r.left + e.clientX * scale, r.top + e.clientY * scale, comp);
      });
    }

    // ---- Wiring -------------------------------------------------------------

    function bindContextMenu() {
      var root = getLayersRoot();
      if (!root) return;
      root.addEventListener('contextmenu', function (e) {
        var row = e.target.closest('.gjs-layer');
        if (!row || !root.contains(row)) return;
        e.preventDefault();
        var comp = getComponentFromRow(row);
        if (comp) openContextMenu(e.clientX, e.clientY, comp);
      });
    }

    editor.on('load', function () {
      bindCanvasMenu();
      bindContextMenu();
      editor.on('component:toggled', startCrumb);
      startCrumb();
    });
    // the canvas iframe is rebuilt on some actions (device change, reload)
    editor.on('canvas:frame:load', bindCanvasMenu);
  }

  return plugin;
});
