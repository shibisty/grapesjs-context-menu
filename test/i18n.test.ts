import { afterEach, describe, expect, it } from 'vitest';
import type { Editor } from 'grapesjs';
import { createTranslator, locales, SUPPORTED_LOCALES } from '../src/i18n';
import en from '../src/i18n/locales/en';
import ru from '../src/i18n/locales/ru';
import uk from '../src/i18n/locales/uk';
import { createEditor, destroyEditor } from './helpers/editor';

describe('built-in locales', () => {
  it('every locale has exactly the English keys, all non-empty', () => {
    const keys = Object.keys(en).sort();
    Object.entries(locales).forEach(([lang, msgs]) => {
      expect(Object.keys(msgs).sort(), lang).toEqual(keys);
      Object.values(msgs).forEach((v) => expect(typeof v === 'string' && v.trim().length > 0, lang).toBe(true));
    });
  });

  it('covers every locale shipped with GrapesJS core (plus uk)', () => {
    // = the files in node_modules/grapesjs/locale/ (same list as grapesjs-cloud-assets)
    const core = ['ar', 'bs', 'ca', 'de', 'el', 'en', 'es', 'fa', 'fr', 'he', 'id', 'it',
      'ko', 'nb', 'nl', 'pl', 'pt', 'ru', 'se', 'tr', 'vi', 'zh'];
    expect([...SUPPORTED_LOCALES].sort()).toEqual([...core, 'uk'].sort());
  });

  it('every non-English locale is actually translated (not an English copy)', () => {
    Object.entries(locales)
      .filter(([lang]) => lang !== 'en')
      .forEach(([lang, msgs]) => {
        const same = (Object.keys(en) as (keyof typeof en)[]).filter((k) => msgs[k] === en[k]);
        expect(same, lang).toEqual([]);
      });
  });

  it('labels are single-line and not padded', () => {
    Object.entries(locales).forEach(([lang, msgs]) => {
      Object.values(msgs).forEach((v) => {
        expect(v, lang).toBe(v.trim());
        expect(/[\n\r]/.test(v), lang).toBe(false);
      });
    });
  });

  it('registers every locale in editor.I18n', async () => {
    const { editor: ed } = await createEditor();
    SUPPORTED_LOCALES.forEach((l) => {
      expect(ed.I18n.t('contextMenu.delete', { l }), l).toBe(locales[l].delete);
    });
    await destroyEditor(ed);
  });
});

describe('createTranslator', () => {
  let editor: Editor;
  afterEach(() => destroyEditor(editor));

  it('uses the editor locale', async () => {
    ({ editor } = await createEditor());
    editor.I18n.setLocale('ru');
    const t = createTranslator(editor, {});
    expect(t('delete')).toBe(ru.delete);
    editor.I18n.setLocale('uk');
    expect(t('delete')).toBe(uk.delete);
  });

  it('falls back to English for an unknown locale', async () => {
    ({ editor } = await createEditor());
    editor.I18n.setLocale('xx');
    expect(createTranslator(editor, {})('selectParent')).toBe(en.selectParent);
  });

  it('explicit labels win over i18n', async () => {
    ({ editor } = await createEditor());
    editor.I18n.setLocale('ru');
    const t = createTranslator(editor, { delete: 'Убрать' });
    expect(t('delete')).toBe('Убрать');
    expect(t('clone')).toBe(ru.clone);
  });

  it('messages added by the host app override the built-in ones', async () => {
    ({ editor } = await createEditor());
    editor.I18n.setLocale('en');
    editor.I18n.addMessages({ en: { contextMenu: { clone: 'Clone it' } } });
    const t = createTranslator(editor, {});
    expect(t('clone')).toBe('Clone it');
    expect(t('delete')).toBe(en.delete);
  });
});
