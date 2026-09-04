/**
 * What makes a password acceptable, in one place.
 *
 * THREE RULES, NOT SEVEN. The change-password screen shows these as a live
 * checklist that ticks as somebody types, and a checklist only works if it is
 * short enough to hold in your head while you are typing into the box above
 * it. Three is what the handoff specifies and three is what a person can
 * satisfy on the first attempt.
 *
 * Each rule is phrased as the thing to DO ("At least 8 characters") rather than
 * as the failure ("Too short"), because the list is read before the password is
 * typed as often as after.
 *
 * EIGHT, NOT SIX. Supabase's own default minimum is six; this is stricter
 * deliberately, and the project's Auth settings should be raised to match so
 * the server agrees with the checklist rather than accepting something the UI
 * has just called incomplete.
 */
export function passwordRequirements(password) {
  const value = String(password ?? "");
  return [
    { label: "At least 8 characters", met: value.length >= 8 },
    { label: "At least one number", met: /\d/.test(value) },
    { label: "At least one capital letter", met: /[A-Z]/.test(value) },
  ];
}

export const passwordIsAcceptable = (password) =>
  passwordRequirements(password).every((requirement) => requirement.met);
