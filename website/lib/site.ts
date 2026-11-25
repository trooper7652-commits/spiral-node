/** Site-wide links and switches. Launch day: set `indexable` to true (the only robots switch). */
const repoUrl = "https://github.com/trooper7652-commits/spiral-node";

export const SITE = {
  siteUrl: "https://spiral-node-helix-velocities.vercel.app", // production address: confirm at launch (launch checklist)
  repoUrl,
  repoApi: "https://api.github.com/repos/trooper7652-commits/spiral-node",
  discussionsUrl: `${repoUrl}/discussions`,
  designPollUrl: "", // empty: the poll button on /design stays hidden; paste the GitHub Discussions poll URL here
  newsletterFormUrl: "https://app.kit.com/forms/10243544/subscriptions", // Kit form "Spiral Node launch list"; empty = popup hidden (except with ?popup=now)
  newsletterEmailField: "email_address", // the hosted form's email field name: "email" (Buttondown) or "email_address" (Kit)
  social: { youtube: "", tiktok: "", instagram: "", bluesky: "", x: "" }, // paste each full https profile URL; empty = hidden
  indexable: false,
  opening: "first" as "first" | "always" | "off", // the scroll-played opening: "first" = first visit only, "always" = every visit, "off" = never
  welcomeFields: { firstName: "fields[first_name]", occupation: "fields[occupation]", broughtHere: "fields[brought_here]" },
  welcomeExtraFields: true,
} as const;
