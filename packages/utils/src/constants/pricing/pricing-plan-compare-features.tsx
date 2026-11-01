import { ReactNode } from "react";
import { nFormatter } from "../../functions/nformatter";
import { INFINITY_NUMBER } from "../misc";
import {
  getPlanLimitForPeriod,
  getPlanPeriodSuffix,
  PlanPeriod,
} from "./plan-period-utils";
import { PLANS } from "./pricing-plans";

export const PRICING_PLAN_COMPARE_FEATURES: {
  category: string;
  href?: string;
  features: {
    text:
      | string
      | ((d: {
          id: string;
          plan: (typeof PLANS)[number];
          planPeriod?: PlanPeriod;
        }) => ReactNode);
    href?: string;
    check?:
      | boolean
      | {
          default?: boolean;
          free?: boolean;
          pro?: boolean;
          business?: boolean;
          advanced?: boolean;
          enterprise?: boolean;
        };
  }[];
}[] = [
  {
    category: "Links",
    features: [
      {
        text: ({ plan, planPeriod = "monthly" }) => (
          <>
            <strong>
              {plan.name === "Enterprise"
                ? "Unlimited"
                : nFormatter(
                    getPlanLimitForPeriod({
                      limit: plan.limits.links,
                      planPeriod,
                    }),
                  )}
            </strong>{" "}
            new links
            {getPlanPeriodSuffix({
              planPeriod,
              isUnlimited: plan.name === "Enterprise",
            })}
          </>
        ),
      },
      {
        text: ({ plan }) => (
          <>
            <strong>
              {plan.limits.tags === INFINITY_NUMBER
                ? "Unlimited"
                : nFormatter(plan.limits.tags)}
            </strong>{" "}
            tags
          </>
        ),
      },
      {
        check: {
          free: false,
          default: true,
        },
        text: ({ plan }) => (
          <>
            <strong>
              {plan.limits.folders === INFINITY_NUMBER
                ? "Unlimited"
                : nFormatter(plan.limits.folders)}
            </strong>{" "}
            folders
          </>
        ),
      },
      {
        text: "Custom QR codes",
      },
      {
        text: "UTM builder + templates",
      },
      {
        check: {
          free: false,
          default: true,
        },
        text: "Custom link previews",
      },
      {
        check: {
          free: false,
          default: true,
        },
        text: "Deep links",
      },
      {
        check: {
          free: false,
          default: true,
        },
        text: "Link cloaking",
      },

      {
        check: {
          free: false,
          default: true,
        },
        text: "Link expiration",
      },
      {
        check: {
          free: false,
          default: true,
        },
        text: "Password protection",
      },
      {
        check: {
          free: false,
          default: true,
        },
        text: "Device targeting",
      },
      {
        check: {
          free: false,
          default: true,
        },
        text: "Geo targeting",
      },
      {
        check: {
          free: false,
          pro: false,
          default: true,
        },
        text: "A/B testing",
      },
    ],
  },
  {
    category: "Analytics",
    features: [
      {
        text: "Advanced analytics",
      },
      {
        text: ({ plan, planPeriod = "monthly" }) => (
          <>
            <strong>
              {plan.name === "Enterprise"
                ? "Unlimited"
                : nFormatter(
                    getPlanLimitForPeriod({
                      limit: plan.limits.clicks,
                      planPeriod,
                    }),
                  )}
            </strong>{" "}
            tracked events
            {getPlanPeriodSuffix({
              planPeriod,
              isUnlimited: plan.name === "Enterprise",
            })}
          </>
        ),
      },
      {
        text: ({ plan }) => (
          <>
            <strong>{plan.limits.retention}</strong> retention
          </>
        ),
      },
      {
        check: {
          default: false,
          business: true,
          advanced: true,
          enterprise: true,
        },
        text: "Conversion tracking",
      },
      {
        check: {
          default: false,
          business: true,
          advanced: true,
          enterprise: true,
        },
        text: "Customer insights",
      },
      {
        check: {
          default: false,
          business: true,
          advanced: true,
          enterprise: true,
        },
        text: "Real-time events stream",
      },
    ],
  },
  {
    category: "Domains",
    features: [
      {
        text: ({ plan }) => (
          <>
            <strong>
              {plan.name === "Enterprise"
                ? "Unlimited"
                : nFormatter(plan.limits.domains, { full: true })}
            </strong>{" "}
            custom domains
          </>
        ),
      },
      {
        text: () => <>SSL certificates</>,
      },
      {
        check: {
          default: true,
          free: false,
        },
        text: () => (
          <>
            Free <strong>.link</strong> domain
          </>
        ),
      },
    ],
  },
  {
    category: "API",
    features: [
      {
        text: "API Access",
      },
      {
        text: "Native SDKs",
      },
      {
        text: ({ id, plan }) => (
          <>
            <strong>
              {id === "enterprise"
                ? "Custom"
                : nFormatter(plan.limits.api, { full: true }) + "/min"}
            </strong>{" "}
            rate limit
          </>
        ),
      },
      {
        check: {
          default: false,
          business: true,
          advanced: true,
          enterprise: true,
        },
        text: "Event webhooks",
      },
    ],
  },
  {
    category: "Workspace",
    features: [
      {
        text: ({ plan }) => (
          <>
            <strong>
              {plan.name === "Enterprise"
                ? "Unlimited"
                : nFormatter(plan.limits.users)}
            </strong>{" "}
            user
            {plan.limits.users === 1 ? "" : "s"}
          </>
        ),
      },
      {
        check: {
          default: false,
          business: true,
          advanced: true,
          enterprise: true,
        },
        text: "Role-based access control",
      },
      {
        check: {
          default: false,
          enterprise: true,
        },
        text: "SAML/SSO",
      },
    ],
  },
  {
    category: "Support",
    features: [
      {
        text: ({ id }) =>
          ({
            free: "Community support",
            pro: "Email support",
            business: "Email support",
            advanced: "Priority email support",
            enterprise: "Slack support with SLA",
          })[id],
      },
      {
        check: {
          default: false,
          enterprise: true,
        },
        text: "Dedicated success manager",
      },
    ],
  },
];
