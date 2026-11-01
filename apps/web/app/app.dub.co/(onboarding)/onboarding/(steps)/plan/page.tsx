"use client";

import { testIds } from "@/lib/e2e/test-ids";
import { DubProductIcon } from "@dub/ui";
import { LaterButton } from "../../later-button";
import { StepPage } from "../step-page";
import { FreePlanButton } from "./free-plan-button";
import { PlanSelector } from "./plan-selector";

export default function Plan() {
  return (
    <StepPage
      headingTestId={testIds.onboarding.stepPlan}
      title={
        <>
          Choose your{" "}
          <span className="group inline-block">
            <DubProductIcon
              product="links"
              className="mb-[3px] ml-1 inline-flex size-5 align-middle transition-transform group-hover:-rotate-12"
              iconClassName="size-3"
            />{" "}
            BrewCC Links
          </span>{" "}
          plan
        </>
      }
      description={
        <>
          <span className="inline-block">
            Find a plan that fits your needs, or
          </span>{" "}
          <FreePlanButton className="text-base underline decoration-dotted underline-offset-2">
            start on the free plan.
          </FreePlanButton>
        </>
      }
      className="max-w-screen-lg"
    >
      <PlanSelector />
      <div className="mx-auto mt-8 flex w-fit flex-col items-center justify-center gap-6 text-sm md:flex-row">
        <LaterButton
          next="success"
          className="underline-offset-4 hover:underline"
          data-testid={testIds.onboarding.freePlan}
        >
          Start for free, pick a plan later
        </LaterButton>
      </div>
    </StepPage>
  );
}
