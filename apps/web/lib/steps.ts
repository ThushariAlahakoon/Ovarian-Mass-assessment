export const STEPS = [
  { slug: 'patient', n: 1, label: 'Patient' },
  { slug: 'survey', n: 2, label: 'Pelvic survey' },
  { slug: 'lesions', n: 3, label: 'Lesions' },
  { slug: 'risk', n: 4, label: 'Risk panel' },
  { slug: 'review', n: 5, label: 'Review' },
  { slug: 'report', n: 6, label: 'Report' },
  { slug: 'follow-up', n: 7, label: 'Follow-up' },
] as const;

export type StepSlug = (typeof STEPS)[number]['slug'];

export function nextStep(slug: StepSlug): StepSlug | null {
  const i = STEPS.findIndex((s) => s.slug === slug);
  return STEPS[i + 1]?.slug ?? null;
}
