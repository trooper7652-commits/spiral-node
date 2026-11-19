import Page from "@/components/Page";
import { listEntries } from "@/lib/buildlog";
import { og } from "@/lib/meta";
import devlog from "../devlog/devlog.module.css";

export const metadata = og("devlog", "Build log | Spiral Node", "Photos and notes from building the first Spiral Node prototypes.");

export default function BuildLogPage() {
  const entries = listEntries();
  return (
    <Page title="Build log">
      <p>Photos and notes from building the first Spiral Node prototypes.</p>
      {entries.length === 0 ? (
        <p>First photos coming soon.</p>
      ) : (
        <ul className={devlog.list}>
          {entries.map((e) => (
            <li key={e.slug} className={devlog.item}>
              <h2 className={devlog.title}>{e.title}</h2>
              <p className={devlog.date}>
                <time dateTime={e.date}>{e.date}</time>
              </p>
              {e.photos.map((f) => (
                <img key={f} src={`/build-log/${f}`} alt={e.title} loading="lazy" style={{ width: "100%", height: "auto", display: "block", marginBottom: "var(--s3)" }} />
              ))}
              <div className={devlog.post} dangerouslySetInnerHTML={{ __html: e.html }} />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
