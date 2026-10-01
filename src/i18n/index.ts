import type { Editor } from 'grapesjs';
import type { ContextMenuLabels } from '../types';

import ar from './locales/ar';
import bs from './locales/bs';
import ca from './locales/ca';
import de from './locales/de';
import el from './locales/el';
import en from './locales/en';
import es from './locales/es';
import fa from './locales/fa';
import fr from './locales/fr';
import he from './locales/he';
import id from './locales/id';
import it from './locales/it';
import ko from './locales/ko';
import nb from './locales/nb';
import nl from './locales/nl';
import pl from './locales/pl';
import pt from './locales/pt';
import ru from './locales/ru';
import se from './locales/se';
import tr from './locales/tr';
import uk from './locales/uk';
import vi from './locales/vi';
import zh from './locales/zh';

/** i18n namespace inside `editor.I18n`: keys are `contextMenu.<label>`. */
export const I18N_NS = 'contextMenu';

/**
 * The same language codes as `grapesjs/locale` (ar, bs, ca, de, el, en, es,
 * fa, fr, he, id, it, ko, nb, nl, pl, pt, ru, se, tr, vi, zh) plus `uk`.
 * Wherever the site configures or detects the GrapesJS core locale, the
 * plugin has a translation under the same code. `se` is Swedish (the core's
 * historical code, see locales/se.ts).
 */
export const locales: Record<string, ContextMenuLabels> = {
  ar,
  bs,
  ca,
  de,
  el,
  en,
  es,
  fa,
  fr,
  he,
  id,
  it,
  ko,
  nb,
  nl,
  pl,
  pt,
  ru,
  se,
  tr,
  uk,
  vi,
  zh,
};

export const SUPPORTED_LOCALES: readonly string[] = Object.keys(locales);

/**
 * Registers every built-in locale in `editor.I18n` under `contextMenu`.
 *
 * Nothing else has to be configured: GrapesJS detects the locale from the
 * browser language by default (`i18n.detectLocale`) and falls back to
 * `localeFallback` ('en') for languages nobody translated.
 *
 * Uses `addMessages()` (merge), not `setMessages()`, so messages from the
 * site config or other plugins survive. To override a phrase of this plugin,
 * call `editor.I18n.addMessages(...)` AFTER the plugin is loaded (e.g. in
 * `editor.onReady`) — the later call wins — or use the `labels` option.
 */
export function registerMessages(editor: Editor): void {
  const i18n = editor.I18n;
  if (!i18n || typeof i18n.addMessages !== 'function') return;
  const messages: Record<string, Record<string, ContextMenuLabels>> = {};
  SUPPORTED_LOCALES.forEach((lang) => {
    messages[lang] = { [I18N_NS]: locales[lang] };
  });
  i18n.addMessages(messages);
}

/**
 * Label lookup order: explicit `labels` option → `editor.I18n` (current
 * locale, then the editor's fallback locale) → built-in English.
 */
export function createTranslator(
  editor: Editor,
  overrides: Partial<ContextMenuLabels>
): (key: keyof ContextMenuLabels) => string {
  return (key) => {
    const own = overrides[key];
    if (typeof own === 'string') return own;
    let msg: unknown;
    try {
      msg = editor.I18n?.t(`${I18N_NS}.${key}`);
    } catch {
      msg = undefined;
    }
    return typeof msg === 'string' && msg ? msg : en[key];
  };
}
