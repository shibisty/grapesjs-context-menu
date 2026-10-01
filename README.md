# grapesjs-context-menu

A GrapesJS plugin that adds a right-click context menu to the **canvas** and
to the **Layer Manager**, plus a clickable **hierarchy badge** over the
selected element.

Menu items:

| Item | What it does |
| --- | --- |
| Add element ▸ | Submenu with every Block Manager block, grouped by category. The block is appended **inside** the target component. Disabled for `droppable: false`. |
| Select parent / Select child | Moves the selection one level up / to the first selectable child. |
| Move up / Move down | Reorders the component among its siblings. |
| Move (drag) | Starts the same `tlb-move` command as the toolbar's "arrows" button: move the pointer, click to drop. |
| Duplicate | Runs `tlb-clone`. |
| View styles | Runs `viewStylesCommand`. Shown only when that command is registered. |
| Delete | Removes the component. Disabled for `removable: false`. |

Every item respects the component's `draggable`, `copyable`, `removable` and
`droppable` flags; impossible actions are shown disabled.

**Hierarchy badge** — a `Name ▾` pill sitting over the selected element.
Clicking it lists the element and all its ancestors up to `<body>`; picking one
selects it. A right-click *inside* the selected element keeps working with it,
so "pick an ancestor in the badge → right-click" is how you act on a wrapper
that is hard to click directly.

Keyboard: `↑`/`↓` move over enabled items, `→` opens "Add element", `←`/`Esc`
close the submenu, `Enter` activates, `Esc` closes the menu.

## Installation

```bash
npm install grapesjs-context-menu
```

```js
import grapesjs from 'grapesjs';
import contextMenu from 'grapesjs-context-menu';

grapesjs.init({
  container: '#gjs',
  plugins: [contextMenu],
  pluginsOpts: {
    [contextMenu]: {
      /* options */
    },
  },
});
```

Or pass the options with a wrapper function:

```js
plugins: [(editor) => contextMenu(editor, { blocks: ['text', 'image'] })];
```

### Without a bundler

The UMD build registers the global `grapesjsContextMenu` (an object with the
plugin as `default`, like the ES module):

```html
<link rel="stylesheet" href="https://unpkg.com/grapesjs/dist/css/grapes.min.css" />
<script src="https://unpkg.com/grapesjs"></script>
<script src="https://unpkg.com/grapesjs-context-menu/dist/grapesjs-context-menu.umd.cjs"></script>
<script>
  grapesjs.init({
    container: '#gjs',
    plugins: [grapesjsContextMenu.default],
  });
</script>
```

The plugin can also be applied to an editor that is already running:
`grapesjsContextMenu.default(editor, { ... })`.

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `blocks` | `string[] \| null` | `null` | Block ids shown in "Add element". `null` = all blocks. |
| `canvasMenu` | `boolean` | `true` | Right-click menu inside the canvas. |
| `layersMenu` | `boolean` | `true` | Right-click menu on Layer Manager rows (wherever the Layer Manager is rendered). |
| `hierarchyBadge` | `boolean` | `true` | The `Name ▾` badge over the selected element. |
| `viewStylesCommand` | `string \| null` | `'layers-sidebar:show-styles'` | Command run by "View styles". The item is hidden while the command isn't registered; `null` hides it for good. |
| `labels` | `Partial<ContextMenuLabels>` | `{}` | Text overrides, see below. |
| `injectCss` | `boolean` | `true` | Inject the plugin CSS. Turn off to ship your own styles (classes are prefixed with `gjs-cm-`). |
| `extendMenu` | `(items, ctx) => items` | — | Change the item list before rendering: reorder, remove, add your own items. |

### Custom items

```js
contextMenu(editor, {
  extendMenu: (items, { component }) => [
    ...items.filter((item) => item.id !== 'move'),
    {
      id: 'log',
      icon: '★',
      label: 'Log to console',
      separator: true, // line above the item
      disabled: !component.getId(),
      run: ({ component, editor, source }) => console.log(source, component.toHTML()),
    },
  ],
});
```

Built-in item ids: `add`, `parent`, `child`, `up`, `down`, `move`, `clone`,
`styles`, `delete`.

### Translations

Labels come from the editor's `I18n` module under the `contextMenu.*` keys.
The plugin ships translations for every language GrapesJS core itself ships
(`grapesjs/locale`): `ar`, `bs`, `ca`, `de`, `el`, `en`, `es`, `fa`, `fr`,
`he`, `id`, `it`, `ko`, `nb`, `nl`, `pl`, `pt`, `ru`, `se` (Swedish — the
core's historical code), `tr`, `vi`, `zh` — plus Ukrainian (`uk`).

Nothing has to be configured: GrapesJS picks the locale from the browser
language (`i18n.detectLocale`, on by default) or from `i18n: { locale: 'de' }`
in the config, and falls back to English for other languages. The list is
exported as `SUPPORTED_LOCALES`, the messages as `locales`.

Add another language or change a phrase the GrapesJS way — after the plugin
is loaded, since the later `addMessages()` call wins:

```js
editor.onReady(() => {
  editor.I18n.addMessages({
    ja: {
      contextMenu: {
        add: '要素を追加',
        delete: '削除',
        // ...
      },
    },
  });
});
```

The `labels` option wins over `I18n` and is the quickest way to override a
single text. Keys: `add`, `noBlocks`, `selectParent`, `selectChild`, `moveUp`,
`moveDown`, `move`, `clone`, `viewStyles`, `delete`, `hierarchyTitle`.

## Events

| Event | Payload |
| --- | --- |
| `context-menu:open` | `{ component, source }` — `source` is `'canvas'` or `'layers'` |
| `context-menu:action` | `{ id, component, source }`; for "Add element" also `added` (the new component) and `block` (block id) |
| `context-menu:close` | `{ component }` |

```js
editor.on('context-menu:action', ({ id, component }) => { /* ... */ });
```

## API

```js
import { getContextMenu } from 'grapesjs-context-menu';

const menu = getContextMenu(editor);
menu.open(x, y, editor.getSelected()); // viewport coordinates of the host page
menu.close();
menu.isOpen;
menu.destroy(); // remove every listener and element of the plugin
```

The plugin cleans up after `editor.destroy()` by itself.

## Compatibility

GrapesJS `>=0.21 <1.0`. Tested against 0.21.13.

## Development

```bash
npm install
npm run dev        # playground: index.html with the plugin from src/
npm test           # vitest + jsdom, a real GrapesJS editor per test
npm run typecheck  # src and tests
npm run build      # dist/: ES module, UMD, .d.ts
```

## License

MIT
