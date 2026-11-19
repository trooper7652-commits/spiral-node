import Page from "@/components/Page";
import Today from "@/components/Today";
import { og } from "@/lib/meta";

export const metadata = og("home", "Today | Spiral Node", "On this day in history, one sourced fact and one question to think about, new every day.");

export default function TodayPage() {
  return (
    <Page title="Today">
      <Today />
    </Page>
  );
}
