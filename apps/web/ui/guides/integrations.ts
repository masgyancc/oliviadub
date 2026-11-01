import { Appwrite } from "@/ui/guides/icons/appwrite";
import { Auth0 } from "@/ui/guides/icons/auth0";
import { BetterAuth } from "@/ui/guides/icons/better-auth";
import { Clerk } from "@/ui/guides/icons/clerk";
import { CodeEditor } from "@/ui/guides/icons/code-editor";
import { Framer } from "@/ui/guides/icons/framer";
import { GoogleTagManager } from "@/ui/guides/icons/gtm";
import { NextAuth } from "@/ui/guides/icons/next-auth";
import { React } from "@/ui/guides/icons/react";
import { Segment } from "@/ui/guides/icons/segment";
import { Shopify } from "@/ui/guides/icons/shopify";
import { Supabase } from "@/ui/guides/icons/supabase";
import { Webflow } from "@/ui/guides/icons/webflow";
import { Wordpress } from "@/ui/guides/icons/wordpress";
import { StripeIcon } from "@dub/ui/icons";

export type IntegrationType = "client-sdk" | "track-lead" | "track-sale";

export type IntegrationGuide = {
  type: IntegrationType;
  key: string;
  title: string;
  description?: string;
  subtitle?: string;
  icon: any;
  iconProps?: {
    fullSize?: boolean;
  };
  recommended?: boolean;
  content?: string;
  stepLabel?: string;
};

export const sections: {
  type: IntegrationType;
  title: string;
  description: string;
}[] = [
  {
    type: "client-sdk",
    title: "Install client-side script",
    description:
      "First, you need to install BrewCC's client-side script, which enables BrewCC to track click events and store them as a first-party cookie on your site.",
  },
  {
    type: "track-lead",
    title: "Track lead events",
    description:
      "Then, you'll track a lead event (e.g. when a user signs up for an account on your application) using our server-side SDKs or REST API.",
  },
  {
    type: "track-sale",
    title: "Track sale events",
    description:
      "Finally, you can use our Stripe integration or server-side SDKs to track sale events (e.g. when a user purchases a product on your application).",
  },
];

export type StackItem = {
  id: string;
  title: string;
  icon: any;
  iconProps?: {
    fullSize?: boolean;
  };
  guideKeys: string[];
  type: IntegrationType;
};

export const stackItems: StackItem[] = [
  {
    id: "react",
    title: "React",
    icon: React,
    guideKeys: ["react"],
    type: "client-sdk",
  },
  {
    id: "gtm",
    title: "Google Tag Manager",
    icon: GoogleTagManager,
    guideKeys: ["gtm-client-sdk", "gtm-track-lead", "gtm-track-sale"],
    type: "client-sdk",
  },
  {
    id: "framer",
    title: "Framer",
    icon: Framer,
    guideKeys: ["framer"],
    type: "client-sdk",
  },
  {
    id: "wordpress",
    title: "WordPress",
    icon: Wordpress,
    guideKeys: ["wordpress"],
    type: "client-sdk",
  },
  {
    id: "webflow",
    title: "Webflow",
    icon: Webflow,
    guideKeys: ["webflow"],
    type: "client-sdk",
  },
  {
    id: "shopify",
    title: "Shopify",
    icon: Shopify,
    guideKeys: ["shopify"],
    type: "client-sdk",
  },
  {
    id: "stripe-checkout",
    title: "Stripe Checkout",
    icon: StripeIcon,
    iconProps: { fullSize: true },
    guideKeys: ["stripe-checkout"],
    type: "track-sale",
  },
  {
    id: "stripe-payment-links",
    title: "Stripe Payment Links",
    icon: StripeIcon,
    iconProps: { fullSize: true },
    guideKeys: ["stripe-payment-links"],
    type: "track-sale",
  },
  {
    id: "stripe-customers",
    title: "Stripe Customers",
    icon: StripeIcon,
    iconProps: { fullSize: true },
    guideKeys: ["stripe-customers"],
    type: "track-sale",
  },
  {
    id: "segment",
    title: "Segment",
    icon: Segment,
    guideKeys: ["segment-track-lead", "segment-track-sale"],
    type: "track-lead",
  },
  {
    id: "clerk",
    title: "Clerk",
    icon: Clerk,
    guideKeys: ["clerk"],
    type: "track-lead",
  },
  {
    id: "better-auth",
    title: "Better Auth",
    icon: BetterAuth,
    guideKeys: ["better-auth"],
    type: "track-lead",
  },
  {
    id: "next-auth",
    title: "NextAuth.js",
    icon: NextAuth,
    guideKeys: ["next-auth"],
    type: "track-lead",
  },
  {
    id: "supabase",
    title: "Supabase",
    icon: Supabase,
    guideKeys: ["supabase"],
    type: "track-lead",
  },
  {
    id: "auth0",
    title: "Auth0",
    icon: Auth0,
    guideKeys: ["auth0"],
    type: "track-lead",
  },
  {
    id: "appwrite",
    title: "Appwrite",
    icon: Appwrite,
    guideKeys: ["appwrite"],
    type: "track-lead",
  },
  {
    id: "custom",
    title: "Custom integration",
    icon: CodeEditor,
    guideKeys: ["manual-client-sdk", "manual-track-lead"],
    type: "client-sdk",
  },
];

export const guides: IntegrationGuide[] = [
  // Client SDK
  {
    type: "client-sdk",
    key: "react",
    title: "React",
    icon: React,
  },
  {
    type: "client-sdk",
    key: "framer",
    title: "Framer",
    icon: Framer,
  },
  {
    type: "client-sdk",
    key: "shopify",
    title: "Shopify",
    icon: Shopify,
  },
  {
    type: "client-sdk",
    key: "wordpress",
    title: "WordPress",
    icon: Wordpress,
  },
  {
    type: "client-sdk",
    key: "webflow",
    title: "Webflow",
    icon: Webflow,
  },
  {
    type: "client-sdk",
    key: "gtm-client-sdk",
    title: "Google Tag Manager",
    icon: GoogleTagManager,
  },
  {
    type: "client-sdk",
    key: "manual-client-sdk",
    title: "Manual Installation",
    description: "Manual Installation",
    icon: CodeEditor,
  },

  // Track Leads
  {
    type: "track-lead",
    key: "manual-track-lead",
    title: "Custom Integration",
    description: "Manual Lead Tracking",
    icon: CodeEditor,
    stepLabel: "Server-side",
  },
  {
    type: "track-lead",
    key: "segment-track-lead",
    title: "Segment",
    icon: Segment,
  },
  {
    type: "track-lead",
    key: "gtm-track-lead",
    title: "Google Tag Manager",
    icon: GoogleTagManager,
  },
  {
    type: "track-lead",
    key: "clerk",
    title: "Clerk",
    icon: Clerk,
  },
  {
    type: "track-lead",
    key: "better-auth",
    title: "Better Auth",
    icon: BetterAuth,
  },
  {
    type: "track-lead",
    key: "next-auth",
    title: "NextAuth.js",
    icon: NextAuth,
  },
  {
    type: "track-lead",
    key: "supabase",
    title: "Supabase",
    icon: Supabase,
  },
  {
    type: "track-lead",
    key: "auth0",
    title: "Auth0",
    icon: Auth0,
  },
  {
    type: "track-lead",
    key: "appwrite",
    title: "Appwrite",
    icon: Appwrite,
  },

  // Track Sales
  {
    type: "track-sale",
    key: "stripe-checkout",
    title: "Stripe",
    subtitle: "Checkout",
    recommended: true,
    description: "Stripe Checkout",
    icon: StripeIcon,
    iconProps: {
      fullSize: true,
    },
  },
  {
    type: "track-sale",
    key: "stripe-payment-links",
    title: "Stripe",
    subtitle: "Payment Links",
    description: "Stripe Payment Links",
    icon: StripeIcon,
    iconProps: {
      fullSize: true,
    },
  },
  {
    type: "track-sale",
    key: "stripe-customers",
    title: "Stripe",
    subtitle: "Customers",
    description: "Stripe Customers",
    icon: StripeIcon,
    iconProps: {
      fullSize: true,
    },
  },
  {
    type: "track-sale",
    key: "segment-track-sale",
    title: "Segment",
    icon: Segment,
  },
  {
    type: "track-sale",
    key: "gtm-track-sale",
    title: "Google Tag Manager",
    icon: GoogleTagManager,
  },
  {
    type: "track-sale",
    key: "manual-track-sale",
    title: "Custom Integration",
    description: "Manual Sale Tracking",
    icon: CodeEditor,
    stepLabel: "Server-side",
  },
];
