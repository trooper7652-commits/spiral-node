import { SITE } from "./site";

export type WelcomeValue = "sent" | "skipped";
const KEY = "sn-welcome";

/**
 * Encodes the welcome form data for Kit.
 * Order: email_address, first name, occupation, brought here.
 */
export function welcomeBody(v: { email: string; firstName?: string; occupation?: string; broughtHere?: string }): URLSearchParams {
  const body = new URLSearchParams();
  body.append(SITE.newsletterEmailField, v.email.trim());

  const { firstName, occupation, broughtHere } = SITE.welcomeFields;

  if (v.firstName?.trim()) body.append(firstName, v.firstName.trim());
  if (v.occupation?.trim()) body.append(occupation, v.occupation.trim());
  if (v.broughtHere?.trim()) body.append(broughtHere, v.broughtHere.trim());

  return body;
}

let memory: WelcomeValue | null = null;

export function readWelcome(): WelcomeValue | null {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "sent" || v === "skipped") return v;
  } catch {
    // blocked
  }
  return memory;
}

export function writeWelcome(v: WelcomeValue): void {
  memory = v;
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // blocked
  }
}
