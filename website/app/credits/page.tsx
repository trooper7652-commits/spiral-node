import Page from "@/components/Page";
import { CREDITS } from "@/lib/credits";
import { og } from "@/lib/meta";

export const metadata = og("home", "Credits | Spiral Node", "The font this site uses, with its source and licence. Every picture is drawn for the site.");

export default function CreditsPage() {
  return (
    <Page band="countryside" title="Credits">
      <p>Every picture on this site is drawn for it. The one outside work it uses is listed here, with its source and licence.</p>
      <p>The people in the scenes are historical figures, drawn from imagination.</p>
      {CREDITS.length === 0 ? (
        <p data-testid="credits-empty">No outside works are used yet.</p>
      ) : (
        <ul data-testid="credits">
          {CREDITS.map((c) => (
            <li key={c.url}>
              <strong>{c.title}</strong>, {c.artist}, {c.year}. {c.source}, <a href={c.url}>{c.licence}</a>. Used on {c.where}.
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
