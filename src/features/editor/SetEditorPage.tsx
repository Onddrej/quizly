import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router';
import { ChevronDown, ClipboardPaste, Plus, Trash2, X } from 'lucide-react';
import { createSet, updateSet } from '../../db/sets';
import { useSetData } from '../../db/useSetData';
import { NotFound } from '../../app/NotFound';
import { useLeave } from '../../app/navigation';
import { newId } from '../../lib/id';
import { DEFINITION_LANGUAGES } from '../../lib/languages';
import { Page } from '../../ui/Page';
import { TopBar } from '../../ui/TopBar';
import { IconButton } from '../../ui/IconButton';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { FieldArea } from '../../ui/FieldArea';
import { InlineConfirm } from '../../ui/InlineConfirm';
import { useToast } from '../../ui/Toast';
import { parsePastedList, type ParseError } from './pasteParser';
import { isFilledRow, validateDraft, type EditorErrors, type EditorRow } from './editorValidation';
import styles from './SetEditorPage.module.css';

const emptyRow = (): EditorRow => ({ key: newId(), term: '', definition: '', meaning: '', examples: '' });

const hasDetails = (row: EditorRow): boolean => Boolean(row.meaning.trim() || row.examples.trim());

function parseErrorText(error: ParseError): string {
  return error.reason === 'no-separator'
    ? `Line ${error.line}: no separator found`
    : `Line ${error.line}: needs a term and a definition`;
}

/** Where to send the user after a failed Save: the title, else the first card with an error, else the first card. */
function firstInvalidId(errors: EditorErrors, rows: readonly EditorRow[]): string {
  if (errors.title) return 'set-title';
  for (const r of rows) {
    const rowErrors = errors.rows?.[r.key];
    if (rowErrors?.term) return `term-${r.key}`;
    if (rowErrors?.definition) return `definition-${r.key}`;
  }
  return rows.length > 0 ? `term-${rows[0].key}` : 'paste-input';
}

interface CardDetailsProps {
  row: EditorRow;
  onChange: (patch: Pick<Partial<EditorRow>, 'meaning' | 'examples'>) => void;
}

/**
 * Collapsible optional definition and examples of one card (spec 5.7). Closed for a new card, open for a card that already
 * has either field. Closing only hides the fields: their text lives in the row and is still saved.
 */
function CardDetails({ row, onChange }: CardDetailsProps) {
  const [open, setOpen] = useState(() => hasDetails(row));
  const panelId = `details-${row.key}`;
  return (
    <>
      <Button
        variant="ghost"
        className={styles.toggle}
        icon={<ChevronDown size={18} className={styles.chevron} />}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? 'Hide definition and examples' : hasDetails(row) ? 'Edit definition and examples' : 'Add definition and examples'}
      </Button>
      <div id={panelId} className={styles.details} hidden={!open}>
        {open && (
          <>
            <FieldArea
              id={`meaning-${row.key}`}
              label="Definition"
              rows={1}
              value={row.meaning}
              lang="en"
              autoCapitalize="off"
              onChange={(e) => onChange({ meaning: e.target.value })}
            />
            <FieldArea
              id={`examples-${row.key}`}
              label="Examples"
              hint="One or two sentences, one per line."
              value={row.examples}
              lang="en"
              onChange={(e) => onChange({ examples: e.target.value })}
            />
          </>
        )}
      </div>
    </>
  );
}

export function SetEditorPage() {
  const { setId } = useParams();
  const editing = setId !== undefined;
  const navigate = useNavigate();
  const leaveTo = editing ? `/sets/${setId}` : '/';
  const leave = useLeave(leaveTo);
  const toast = useToast();
  const { loading, set, cards } = useSetData(setId);

  const [initialized, setInitialized] = useState(!editing);
  const [title, setTitle] = useState('');
  const [definitionLang, setDefinitionLang] = useState('sk');
  const [rows, setRows] = useState<EditorRow[]>(() => [emptyRow(), emptyRow()]);
  const [paste, setPaste] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ id: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const leavingAfterSave = useRef(false);

  const parsed = useMemo(() => parsePastedList(paste), [paste]);
  // Errors appear with the first Save attempt and then follow the form, so each one goes away as soon as its field is fixed.
  const errors = useMemo<EditorErrors>(() => (submitted ? validateDraft(title, rows).errors : {}), [submitted, title, rows]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !leavingAfterSave.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!editing || initialized || loading || !set) return;
    setTitle(set.title);
    setDefinitionLang(set.definitionLang);
    setRows(
      cards.map((c) => ({
        key: c.id,
        id: c.id,
        term: c.term,
        definition: c.definition,
        meaning: c.meaning ?? '',
        examples: c.examples ?? '',
      })),
    );
    setInitialized(true);
  }, [editing, initialized, loading, set, cards]);

  // The control to focus and bring into view (the first error after a failed Save, the new card's Term after Add card).
  useEffect(() => {
    if (!focusRequest) return;
    const el = document.getElementById(focusRequest.id);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView?.({ block: 'center' });
  }, [focusRequest]);

  if (editing && !loading && !set) return <NotFound title="This set doesn't exist" />;
  if (!initialized) return null;

  const touch = () => setDirty(true);

  function updateRow(key: string, patch: Partial<EditorRow>) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    touch();
  }

  function addPasted() {
    if (parsed.pairs.length === 0) return;
    setRows((current) => [
      ...current.filter(isFilledRow),
      ...parsed.pairs.map((p) => ({ key: newId(), term: p.term, definition: p.definition, meaning: '', examples: '' })),
    ]);
    setPaste('');
    touch();
  }

  async function save() {
    const result = validateDraft(title, rows);
    setSubmitted(true);
    if (!result.ok) {
      setFocusRequest({ id: firstInvalidId(result.errors, rows) });
      return;
    }
    setSaving(true);
    try {
      const draft = { title, definitionLang, cards: result.cards };
      if (setId) {
        await updateSet(setId, draft);
        leavingAfterSave.current = true;
        leave(); // back to the Set page: a pop when that page is directly behind
      } else {
        const id = await createSet(draft);
        leavingAfterSave.current = true;
        navigate(`/sets/${id}`, { replace: true }); // the new Set page takes the editor's place
      }
    } catch {
      toast("Couldn't save. Try again.");
      setSaving(false);
    }
  }

  const addLabel = parsed.pairs.length === 1 ? 'Add 1 card' : `Add ${parsed.pairs.length} cards`;

  return (
    <Page
      bottom={
        blocker.state === 'blocked' ? (
          <div className={styles.confirm}>
            <InlineConfirm
              message="Discard changes?"
              confirmLabel="Discard"
              cancelLabel="Keep editing"
              danger
              onConfirm={() => blocker.proceed()}
              onCancel={() => blocker.reset()}
            />
          </div>
        ) : undefined
      }
      top={
        <TopBar
          left={<IconButton label="Close" icon={<X size={20} />} onClick={leave} />}
          title={editing ? 'Edit set' : 'Create set'}
          right={
            <Button variant="ghost" onClick={save} disabled={saving}>
              Save
            </Button>
          }
        />
      }
    >
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
          Translation:
          <select
            aria-label="Translation language"
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
          One pair per line. Separate term and translation with a dash, tab or comma.
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
              lang="en"
              autoCapitalize="off"
              error={errors.rows?.[r.key]?.term}
              onChange={(e) => updateRow(r.key, { term: e.target.value })}
            />
            <Field
              id={`definition-${r.key}`}
              label="Translation"
              value={r.definition}
              lang={definitionLang}
              error={errors.rows?.[r.key]?.definition}
              onChange={(e) => updateRow(r.key, { definition: e.target.value })}
            />
            <CardDetails row={r} onChange={(patch) => updateRow(r.key, patch)} />
          </li>
        ))}
      </ol>

      <Button
        variant="outline"
        block
        icon={<Plus size={20} />}
        onClick={() => {
          const row = emptyRow();
          setRows((current) => [...current, row]);
          touch();
          setFocusRequest({ id: `term-${row.key}` });
        }}
      >
        Add card
      </Button>
    </Page>
  );
}
