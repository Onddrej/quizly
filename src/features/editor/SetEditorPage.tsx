import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router';
import { ClipboardPaste, Plus, Trash2, X } from 'lucide-react';
import { createSet, updateSet } from '../../db/sets';
import { useSetData } from '../../db/useSetData';
import { NotFound } from '../../app/NotFound';
import { newId } from '../../lib/id';
import { DEFINITION_LANGUAGES } from '../../lib/languages';
import { Page } from '../../ui/Page';
import { TopBar } from '../../ui/TopBar';
import { IconButton } from '../../ui/IconButton';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { InlineConfirm } from '../../ui/InlineConfirm';
import { useToast } from '../../ui/Toast';
import { parsePastedList, type ParseError } from './pasteParser';
import { validateDraft, type EditorErrors, type EditorRow } from './editorValidation';
import styles from './SetEditorPage.module.css';

const emptyRow = (): EditorRow => ({ key: newId(), term: '', definition: '' });

function parseErrorText(error: ParseError): string {
  return error.reason === 'no-separator'
    ? `Line ${error.line}: no separator found`
    : `Line ${error.line}: needs a term and a definition`;
}

export function SetEditorPage() {
  const { setId } = useParams();
  const editing = setId !== undefined;
  const navigate = useNavigate();
  const toast = useToast();
  const { loading, set, cards } = useSetData(setId);

  const [initialized, setInitialized] = useState(!editing);
  const [title, setTitle] = useState('');
  const [definitionLang, setDefinitionLang] = useState('sk');
  const [rows, setRows] = useState<EditorRow[]>(() => [emptyRow(), emptyRow()]);
  const [paste, setPaste] = useState('');
  const [errors, setErrors] = useState<EditorErrors>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const leavingAfterSave = useRef(false);

  const parsed = useMemo(() => parsePastedList(paste), [paste]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !leavingAfterSave.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!editing || initialized || loading || !set) return;
    setTitle(set.title);
    setDefinitionLang(set.definitionLang);
    setRows(cards.map((c) => ({ key: c.id, id: c.id, term: c.term, definition: c.definition })));
    setInitialized(true);
  }, [editing, initialized, loading, set, cards]);

  if (editing && !loading && !set) return <NotFound title="This set doesn't exist" />;
  if (!initialized) return null;

  const leaveTo = editing ? `/sets/${setId}` : '/';
  const touch = () => setDirty(true);

  function updateRow(key: string, patch: Partial<EditorRow>) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    touch();
  }

  function addPasted() {
    if (parsed.pairs.length === 0) return;
    setRows((current) => [
      ...current.filter((r) => r.term.trim() || r.definition.trim()),
      ...parsed.pairs.map((p) => ({ key: newId(), term: p.term, definition: p.definition })),
    ]);
    setPaste('');
    touch();
  }

  async function save() {
    const result = validateDraft(title, rows);
    setErrors(result.errors);
    if (!result.ok) return;
    setSaving(true);
    try {
      const draft = { title, definitionLang, cards: result.cards };
      let id = setId;
      if (id) await updateSet(id, draft);
      else id = await createSet(draft);
      leavingAfterSave.current = true;
      navigate(`/sets/${id}`, { replace: true });
    } catch {
      toast("Couldn't save. Try again.");
      setSaving(false);
    }
  }

  const addLabel = parsed.pairs.length === 1 ? 'Add 1 card' : `Add ${parsed.pairs.length} cards`;

  return (
    <Page
      top={
        <TopBar
          left={<IconButton label="Close" icon={<X size={20} />} onClick={() => navigate(leaveTo)} />}
          title={editing ? 'Edit set' : 'Create set'}
          right={
            <Button variant="ghost" onClick={save} disabled={saving}>
              Save
            </Button>
          }
        />
      }
    >
      {blocker.state === 'blocked' && (
        <InlineConfirm
          message="Discard changes?"
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          danger
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        />
      )}

      <Field
        id="set-title"
        label="Title"
        value={title}
        placeholder="e.g. Travel & airport"
        error={errors.title}
        onChange={(e) => {
          setTitle(e.target.value);
          touch();
        }}
      />

      <div className={styles.langRow}>
        <span className={styles.langChip}>Term: English</span>
        <label className={styles.langChip}>
          Definition:
          <select
            aria-label="Definition language"
            value={definitionLang}
            onChange={(e) => {
              setDefinitionLang(e.target.value);
              touch();
            }}
          >
            {DEFINITION_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className={styles.paste} aria-labelledby="paste-heading">
        <h2 id="paste-heading" className={styles.pasteHead}>
          <ClipboardPaste size={20} />
          Paste a list
        </h2>
        <label htmlFor="paste-input" className={styles.hint}>
          One pair per line. Separate term and definition with a dash, tab or comma.
        </label>
        <textarea
          id="paste-input"
          rows={4}
          value={paste}
          placeholder={'gate - brána\nlayover - prestup'}
          onChange={(e) => setPaste(e.target.value)}
        />
        {parsed.errors.length > 0 && (
          <ul className={styles.parseErrors}>
            {parsed.errors.map((error) => (
              <li key={error.line}>{parseErrorText(error)}</li>
            ))}
          </ul>
        )}
        <Button variant="outline" onClick={addPasted} disabled={parsed.pairs.length === 0}>
          {addLabel}
        </Button>
      </section>

      {errors.cards && (
        <p className={styles.formError} role="alert">
          {errors.cards}
        </p>
      )}

      <ol className={styles.rows}>
        {rows.map((r, index) => (
          <li key={r.key} className={`card ${styles.row}`}>
            <div className={styles.rowHead}>
              <span className={styles.num}>{index + 1}</span>
              <IconButton
                size="sm"
                label={`Delete card ${index + 1}`}
                icon={<Trash2 size={18} />}
                onClick={() => {
                  setRows((current) => current.filter((x) => x.key !== r.key));
                  touch();
                }}
              />
            </div>
            <Field
              id={`term-${r.key}`}
              label="Term"
              value={r.term}
              autoCapitalize="off"
              error={errors.rows?.[r.key]?.term}
              onChange={(e) => updateRow(r.key, { term: e.target.value })}
            />
            <Field
              id={`definition-${r.key}`}
              label="Definition"
              value={r.definition}
              error={errors.rows?.[r.key]?.definition}
              onChange={(e) => updateRow(r.key, { definition: e.target.value })}
            />
          </li>
        ))}
      </ol>

      <Button
        variant="outline"
        block
        icon={<Plus size={20} />}
        onClick={() => {
          setRows((current) => [...current, emptyRow()]);
          touch();
        }}
      >
        Add card
      </Button>
    </Page>
  );
}
