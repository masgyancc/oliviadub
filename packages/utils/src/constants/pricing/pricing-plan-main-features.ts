import { ReactNode } from "react";
import { nFormatter } from "../../functions/nformatter";
import {
  getPlanLimitForPeriod,
  getPlanPeriodSuffix,
  PlanPeriod,
} from "./plan-period-utils";
import { PLANS } from "./pricing-plans";

type Plan = (typeof PLANS)[number];

type HeroFeature = {
  id?: string;
  text: string;
  disabled?: boolean;
  tooltip?:
    | ReactNode
    | {
        title: string;
        cta?: string;
        href?: string;
      };
};

const getLinksStandards = (
  plan: Plan,
  planPeriod: PlanPeriod = "monthly",
): HeroFeature[] => {
  return [
    // Tracked events
    {
      id: "clicks",
      text:
        plan.name === "Enterprise"
          ? "Unlimited tracked events"
          : `${nFormatter(
              getPlanLimitForPeriod({
                limit: plan.limits.clicks,
                planPeriod,
              }),
            )} tracked events${getPlanPeriodSuffix({ planPeriod })}`,
    },
    // New links
    {
      id: "links",
      text:
        plan.name === "Enterprise"
          ? "Unlimited new links"
          : `${nFormatter(
              getPlanLimitForPeriod({
                limit: plan.limits.links,
                planPeriod,
              }),
            )} new links${getPlanPeriodSuffix({ planPeriod })}`,
    },
    ...(plan.name !== "Enterprise"
      ? [
          {
            id: "retention",
            text: `${plan.limits.retention} analytics retention`,
          },
        ]
      : []),
  ];
};

export const getPricingPlanMainFeatures = (
  planPeriod: PlanPeriod = "monthly",
) => ({
  links: {
    Pro: [
      {
        features: [
          ...getLinksStandards(
            PLANS.find((p) => p.name === "Pro")!,
            planPeriod,
          ),
          {
            id: "advanced",
            text: "Advanced link features",
            tooltip: {
              title:
                "Supercharge your links with custom link previews, device targeting, geo targeting, link cloaking, password protection, and more.",
            },
          },
          {
            id: "dotlink",
            text: "Free .link domain",
            tooltip: {
              title:
                "Get a free .link custom domain for 1 year with any of the paid plans.",
            },
          },
          {
            id: "folders",
            text: "Link folders",
            tooltip: {
              title:
                "Organize and manage access to your links on BrewCC using folders.",
            },
          },
          {
            id: "deeplinks",
            text: "Deep links",
            tooltip: {
              title:
                "Redirect users to a specific page within your mobile application using deep links.",
            },
          },
        ],
      },
    ],
    Business: [
      {
        features: [
          ...getLinksStandards(
            PLANS.find((p) => p.name === "Business")!,
            planPeriod,
          ),
          {
            id: "conversions",
            text: "Conversion tracking",
            tooltip: {
              title:
                "Track how your link clicks are converting to signups and sales.",
            },
          },
          {
            id: "tests",
            text: "A/B testing",
            tooltip: {
              title:
                "Run A/B tests to compare different short-link variations and identify what drives the highest conversions.",
            },
          },
          {
            id: "roles",
            text: "Customer insights",
            tooltip: {
              title:
                "Get real-time insights into your customers' behavior and preferences.",
            },
          },
          {
            id: "webhooks",
            text: "Event webhooks",
            tooltip: {
              title:
                "Get real-time notifications when a link is clicked or a QR code is scanned using webhooks.",
            },
          },
        ],
      },
    ],
    Advanced: [
      {
        features: [
          ...getLinksStandards(
            PLANS.find((p) => p.name === "Advanced")!,
            planPeriod,
          ),
          {
            id: "api",
            text: "Elevated API rate limits",
            tooltip: {
              title:
                "Get access to elevated API rate limits to build advanced integrations and automate your workflows.",
            },
          },
          {
            id: "success",
            text: "Priority email support",
          },
        ],
      },
    ],
    Enterprise: [
      {
        features: [
          ...getLinksStandards(
            PLANS.find((p) => p.name === "Enterprise")!,
            planPeriod,
          ),
          {
            id: "sso",
            text: "SAML/SSO",
          },
          {
            id: "slack",
            text: "Dedicated Slack support",
          },
        ],
      },
    ],
  },
});
