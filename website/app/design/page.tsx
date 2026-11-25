import Page from "@/components/Page";
import { og } from "@/lib/meta";
import { SITE } from "@/lib/site";

export const metadata = og("home", "Design explorations | Spiral Node", "Five concept shapes for Spiral Node. Prototype design, may change.");

export default function DesignPage() {
  return (
    <Page band="device" title="Design explorations">
      <p>Prototype design, may change. Which shape would you carry?</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/design/form-factors.svg"
        width={1560}
        height={950}
        style={{ width: "100%", height: "auto", display: "block" }}
        alt="Concept sketch sheet of five Spiral Node shapes: Harmonica bar, Snail-shell puck, Pocket book, Locket, and Standing stone."
      />
      {SITE.designPollUrl ? (
        <p>
          <a className="btn" href={SITE.designPollUrl}>
            Vote in the poll
          </a>
        </p>
      ) : null}
    </Page>
  );
}
