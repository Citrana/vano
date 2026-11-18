/**
 * The "Get your shop ready" checklist on the seller dashboard. Pure: the
 * dashboard shows it, `shops.hideChecklist` checks it again.
 */
export const ONBOARDING_STEPS = ["created", "product", "look", "share"] as const;
export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number];
export type OnboardingStep = { key: OnboardingStepKey; done: boolean };

export function onboardingSteps(input: {
  productCount: number;
  theme: string | undefined | null;
  linkSharedAt: number | undefined | null;
}): OnboardingStep[] {
  const done: Record<OnboardingStepKey, boolean> = {
    // The checklist only exists once the shop does.
    created: true,
    product: input.productCount > 0,
    look: input.theme != null,
    share: input.linkSharedAt != null,
  };
  return ONBOARDING_STEPS.map((key) => ({ key, done: done[key] }));
}

export function allStepsDone(steps: OnboardingStep[]): boolean {
  return steps.every((step) => step.done);
}
