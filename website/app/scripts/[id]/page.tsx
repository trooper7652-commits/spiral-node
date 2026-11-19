import Link from "next/link";
import { notFound } from "next/navigation";
import CopyLink from "@/components/CopyLink";
import Page from "@/components/Page";
import { og } from "@/lib/meta";
import { getScript, listScripts } from "@/lib/scripts";

export const dynamicParams = false;

export function generateStaticParams() {
  return listScripts().map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const s = getScript((await params).id);
  return s ? og(`script-${s.id}`, `${s.name} | Spiral Node`, s.description) : {};
}

export default async function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const s = getScript((await params).id);
  if (!s) notFound();
  return (
    <Page title={s.name}>
      <p>{s.description}</p>
      <p>by {s.community ? <a href={`https://github.com/${encodeURIComponent(s.author)}`}>{s.author}</a> : s.author}</p>
      <p>
        <Link className="btn" href={`/try?script=${s.id}`}>
          Run in simulator
        </Link>{" "}
        <CopyLink />
      </p>
      <p>
        <Link href="/scripts">Back to all scripts</Link>
      </p>
    </Page>
  );
}
