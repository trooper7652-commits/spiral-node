import s from "./holds.module.css";

/** A word revealed letter by letter from the section's --hold-t (CSS only; whole when unset). */
export default function WriteOut({ text }: { text: string }) {
  const letters = [...text];
  return (
    <>
      <span className={s.sr}>{text}</span>
      <span aria-hidden="true">
        {letters.map((c, i) => (
          <span key={i} className={s.letter} style={{ "--i": i, "--n": letters.length } as React.CSSProperties}>
            {c}
          </span>
        ))}
      </span>
    </>
  );
}
