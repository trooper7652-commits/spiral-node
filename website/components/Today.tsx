"use client";
import { useEffect, useState } from "react";
import { localDate, otdTopics, pickForDate, type TodayEvent, type TodayFacts } from "@/lib/today";

type Data = { date: string; events: TodayEvent[]; facts: TodayFacts };

function Source({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      Source
    </a>
  );
}

/** Today's date, its On This Day events, one fact and one question, picked by the visitor's local date. */
export default function Today() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const date = localDate(new Date());
    const get = (url: string) =>
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(url);
        return r.json();
      });
    Promise.all([get(`/today/otd-${date.slice(5, 7)}.json`), get("/today/facts.json")])
      .then(([events, facts]: [TodayEvent[], TodayFacts]) => {
        const topics = otdTopics(date);
        setData({ date, events: events.filter((e) => topics.includes(e.topic)), facts });
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <p>Could not load today&apos;s page. Try again later.</p>;
  if (!data) return <p>Loading today...</p>;

  const { date, events, facts } = data;
  const [y, m, d] = date.split("-").map(Number);
  const written = new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const fact = facts.facts[pickForDate(date, facts.facts.length)];
  const question = facts.questions[pickForDate(date, facts.questions.length)];

  return (
    <>
      <p>{written}</p>
      <h2>On This Day</h2>
      <ul data-testid="today-events">
        {events.map((e) => (
          <li key={e.id}>
            {e.text} <Source href={e.source} />
          </li>
        ))}
      </ul>
      <p data-testid="today-credit">
        Event text adapted from <a href="https://en.wikipedia.org/wiki/Wikipedia:Selected_anniversaries">Wikipedia&apos;s On this day</a>,{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.
      </p>
      <h2>Fact</h2>
      <p data-testid="today-fact">
        {fact.text} <Source href={fact.source} />
      </p>
      <h2>Question</h2>
      <p data-testid="today-question">{question.text}</p>
    </>
  );
}
