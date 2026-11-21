/** Site-wide links and switches. Launch day: set `indexable` to true (the only robots switch). */
const repoUrl = "https://github.com/trooper7652-commits/spiral-node";

export const SITE = {
  siteUrl: "https://spiral-node-helix-velocities.vercel.app", // Vercel production address; change when a custom domain is added
  repoUrl,
  repoApi: "https://api.github.com/repos/trooper7652-commits/spiral-node",
  discussionsUrl: `${repoUrl}/discussions`,
  designPollUrl: "", // empty: the poll button on /design stays hidden; paste the GitHub Discussions poll URL here
  newsletterFormUrl: "", // empty: the sign-up popup stays hidden (except with ?popup=now)
  newsletterEmailField: "email", // the hosted form's email field name: "email" (Buttondown) or "email_address" (Kit)
  indexable: true,
} as const;
