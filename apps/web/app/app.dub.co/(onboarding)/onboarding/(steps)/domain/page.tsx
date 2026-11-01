import { testIds } from "@/lib/e2e/test-ids";
import { StepPage } from "../step-page";
import { DefaultDomainSelector } from "./default-domain-selector";

export default function Domain() {
  return (
    <StepPage
      headingTestId={testIds.onboarding.stepDomain}
      title="Add a custom domain"
      description={
        <>
          Make your links stand out and{" "}
          boost click-through rates by 30%
        </>
      }
      className="max-w-none [&>div:first-of-type]:max-w-[640px]"
    >
      <DefaultDomainSelector />
    </StepPage>
  );
}
