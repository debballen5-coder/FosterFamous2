/**
 * ============================================================================
 * FOSTER FAMOUS — CRITICAL ACCURACY RULES
 * ============================================================================
 *
 * Read this before changing any content-generation feature.
 *
 * Foster Famous produces marketing copy about REAL animals whose placement is
 * controlled by a shelter or rescue. Inaccurate copy can get an animal placed
 * in the wrong home, injure a person or another pet, or expose a foster
 * family's home address. Every generator, template, prompt, and share sheet
 * in this app MUST obey the rules below.
 *
 * These are encoded as constants so they can be injected verbatim into future
 * AI prompts and asserted against in tests. Do not soften the wording.
 */

/** Hard prohibitions. Injected into every future content-generation prompt. */
export const NEVER_RULES: readonly string[] = [
  'Never invent temperament, personality traits, or behavior the foster parent did not record.',
  'Never invent or infer medical history, diagnoses, treatments, or vet outcomes.',
  'Never invent behavioral history, bite history, training history, or past-home history.',
  'Never claim a pet is good with dogs, cats, or children when the recorded value is Unknown or Still Evaluating.',
  'Never hide, minimize, or omit important behavioral or medical information the foster parent recorded.',
  'Never publish, hint at, or include the foster home address, cross-streets, or precise location.',
  'Never promise or imply an adopter will get the animal when placement is decided by the shelter or rescue.',
] as const;

/** How unknown / in-progress values must be surfaced in generated copy. */
export const UNKNOWN_VALUE_POLICY = {
  /** An unknown field stays explicitly unknown. It is never rounded up to "yes". */
  rule: 'Unknown values must remain explicitly unknown. Never upgrade Unknown or Still Evaluating to a positive claim.',
  /** Approved phrasings a generator may use instead of a claim. */
  approvedPhrasings: [
    'Still being evaluated',
    'Not yet known',
    'Ask the rescue for the latest',
    'We are still learning about this',
  ],
} as const;

/** Copy that accompanies shared or exported content. */
export const REQUIRED_DISCLOSURES = {
  placement:
    'Adoption decisions are made by the shelter or rescue. Foster Famous helps you promote — it does not approve adopters.',
  accuracy:
    'Everything Foster Famous writes comes from what you recorded. Review it before posting and correct anything that has changed.',
  location: 'Share the rescue’s city and contact info — never your home address.',
} as const;

/** Field values that must be treated as "no claim can be made". */
export const NON_CLAIMABLE_VALUES: readonly string[] = [
  'Unknown',
  'Still evaluating',
  'Still Evaluating',
  'Not yet known',
] as const;

/** Whether a recorded value is safe to make as a positive claim. */
export function isClaimable(value: string | null | undefined): boolean {
  if (!value) return false;
  return !NON_CLAIMABLE_VALUES.some((v) => v.toLowerCase() === value.trim().toLowerCase());
}
