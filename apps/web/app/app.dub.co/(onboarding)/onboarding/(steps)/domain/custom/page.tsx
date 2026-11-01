import { testIds } from "@/lib/e2e/test-ids";
import { StepPage } from "../../step-page";
import { Form } from "./form";

export default function Custom() {
  return (
    <StepPage
      headingTestId={testIds.onboarding.stepDomainCustom}
      title="Connect a custom domain"
      description="Use a domain you own for your short links."
    >
      <Form />
    </StepPage>
  );
}
