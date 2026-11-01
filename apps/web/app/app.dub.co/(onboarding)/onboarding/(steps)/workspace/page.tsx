import { testIds } from "@/lib/e2e/test-ids";
import { StepPage } from "../step-page";
import { Form } from "./form";

export default function Workspace() {
  return (
    <StepPage
      headingTestId={testIds.onboarding.stepWorkspace}
      title="Create your workspace"
      description={
        <>
          Where you'll work with your team to create, manage, and track your
          short links.
        </>
      }
    >
      <Form />
    </StepPage>
  );
}
