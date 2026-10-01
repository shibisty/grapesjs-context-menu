import type { ContextMenuLabels } from '../../types';

/**
 * Ukrainian. GrapesJS core has no `uk` locale; the plugin menu is still
 * translated when the editor locale is set to `uk`.
 */
const messages: ContextMenuLabels = {
  add: 'Додати елемент',
  noBlocks: 'Немає доступних блоків',
  selectParent: 'Вибрати батьківський',
  selectChild: 'Вибрати вкладений',
  moveUp: 'Перемістити вище',
  moveDown: 'Перемістити нижче',
  move: 'Перемістити (перетягування)',
  clone: 'Копіювати',
  viewStyles: 'Переглянути стилі',
  delete: 'Видалити',
  hierarchyTitle: 'Ієрархія: виберіть, з яким елементом працювати',
};

export default messages;
