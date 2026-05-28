import { useEffect, useRef, useState } from 'react';

export function EditableName({ value, onSubmit }: { value: string; onSubmit: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSubmit(trimmed);
    } else {
      setDraft(value);
    }
  }

  if (!editing) {
    return (
      <button type="button" className="slot-name-edit" onClick={() => setEditing(true)}>
        <strong className="slot-name">{value}</strong>
        <span className="edit-hint" aria-hidden>
          edit
        </span>
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      className="slot-name-input"
      value={draft}
      maxLength={24}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}
