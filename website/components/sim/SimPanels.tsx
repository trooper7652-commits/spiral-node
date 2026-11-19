"use client";
import { useRef } from "react";
import { COLOURWAYS, type Colourway } from "./Device";
import styles from "./Sim.module.css";

export function Guide({ open }: { open: boolean }) {
  return (
    <details className={`pixel-box ${styles.fold}`} open={open}>
      <summary>How to use</summary>
      <p>
        Up, down, left, right: the edges of the wheel (or arrow keys). Select: the centre (Enter or Space). Back: the Back
        button (or Backspace, Esc); holding select for 0.6 s also goes Back. Home: the Home button (or H) jumps to Home from anywhere. On Home, right shows the next entry and left the
        previous one. Scripts are small programs; pick one, set its refresh time, press OK.
      </p>
    </details>
  );
}

type ToolsProps = {
  realism: boolean;
  onRealism: (on: boolean) => void;
  canReset: boolean;
  onReset: () => void;
  info: { screen: string; refresh: string; saving: string };
};

export function Tools({ realism, onRealism, canReset, onReset, info }: ToolsProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <details className={`pixel-box ${styles.fold}`}>
        <summary>Tools</summary>
        <div className={styles.tools}>
          <label className={styles.check}>
            <input type="checkbox" checked={realism} onChange={(e) => onRealism(e.target.checked)} />
            Realistic e-ink
          </label>
          <button type="button" className={styles.plain} disabled={!canReset} onClick={() => dialog.current?.showModal()}>
            Reset device
          </button>
          {!canReset && <p className={styles.hint}>Power on first.</p>}
          <details className={styles.inspector}>
            <summary>Inspector</summary>
            <dl>
              <dt>Screen</dt>
              <dd>{info.screen}</dd>
              <dt>Last refresh</dt>
              <dd>{info.refresh}</dd>
              <dt>Saving</dt>
              <dd>{info.saving}</dd>
            </dl>
          </details>
        </div>
      </details>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby="erase-q">
        <form method="dialog">
          <p id="erase-q">Erase this simulated device&apos;s saved state?</p>
          <div className={styles.dialogRow}>
            <button type="submit" className={styles.plain} value="cancel" autoFocus>
              Cancel
            </button>
            <button type="submit" className={styles.danger} value="erase" onClick={onReset}>
              Erase
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function ColourwayPicker({ value, onChange }: { value: Colourway; onChange: (c: Colourway) => void }) {
  return (
    <fieldset className={styles.picker}>
      <legend>Colour</legend>
      {COLOURWAYS.map((c) => (
        <label key={c} data-colourway={c}>
          <input type="radio" name="colourway" value={c} checked={value === c} onChange={() => onChange(c)} />
          <span aria-hidden="true" className={styles.swatch} />
          <span className={styles.swatchName}>{c[0].toUpperCase() + c.slice(1)}</span>
        </label>
      ))}
    </fieldset>
  );
}
