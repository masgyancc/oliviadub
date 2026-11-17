"use client";

import { AnimatedSizeContainer, Button } from "@dub/ui";
import { useSearchParams } from "next/navigation";
import {
  ComponentType,
  Dispatch,
  SetStateAction,
  createContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import { AuthMethodsSeparator } from "../auth-methods-separator";
import { EmailSignIn } from "./email-sign-in";
import { GitHubButton } from "./github-button";
import { GoogleButton } from "./google-button";
import { SSOSignIn } from "./sso-sign-in";

export const authMethods = [
  "google",
  "github",
  "email",
  "saml",
  "password",
] as const;

export type AuthMethod = (typeof authMethods)[number];

export const errorCodes = {
  "no-credentials": "Please provide an email and password.",
  "invalid-credentials": "Email or password is incorrect.",
  "exceeded-login-attempts":
    "Account has been locked due to too many login attempts. Please contact support to unlock your account.",
  "too-many-login-attempts": "Too many login attempts. Please try again later.",
  "email-not-verified": "Please verify your email address.",
  "session-expired":
    "You were signed out after 1 hour without activity. Please log in again.",
  "captcha-failed":
    "Please complete the security check (CAPTCHA) and try again.",
  "require-saml-sso":
    "Your organization requires authentication through your company's identity provider.",
  EmailSignin:
    "Failed to send login email. Please try again in a minute or contact support.",
  Callback:
    "We encountered an issue processing your request. Please try again or contact support if the problem persists.",
  OAuthSignin:
    "There was an issue signing you in. Please ensure your provider settings are correct.",
  OAuthCallback:
    "We faced a problem while processing the response from the OAuth provider. Please try again.",
  OAuthAccountNotLinked:
    "It looks like you already have an account with this email. Please sign in with your account email instead.",
};

export const LoginFormContext = createContext<{
  authMethod: AuthMethod | undefined;
  setAuthMethod: Dispatch<SetStateAction<AuthMethod | undefined>>;
  clickedMethod: AuthMethod | undefined;
  showPasswordField: boolean;
  showSSOOption: boolean;
  setShowPasswordField: Dispatch<SetStateAction<boolean>>;
  setClickedMethod: Dispatch<SetStateAction<AuthMethod | undefined>>;
  setLastUsedAuthMethod: Dispatch<SetStateAction<AuthMethod | undefined>>;
  setShowSSOOption: Dispatch<SetStateAction<boolean>>;
}>({
  authMethod: undefined,
  setAuthMethod: () => {},
  clickedMethod: undefined,
  showPasswordField: false,
  showSSOOption: false,
  setShowPasswordField: () => {},
  setClickedMethod: () => {},
  setLastUsedAuthMethod: () => {},
  setShowSSOOption: () => {},
});

export default function LoginForm({
  methods = [...authMethods],
  next,
}: {
  methods?: AuthMethod[];
  next?: string;
}) {
  const searchParams = useSearchParams();
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [showSSOOption, setShowSSOOption] = useState(false);
  const [clickedMethod, setClickedMethod] = useState<AuthMethod | undefined>(
    undefined,
  );

  // BrewCC: the last used sign-in method isn't remembered or suggested anymore
  // (shared or public computers); every login starts from the same choices
  const setLastUsedAuthMethod: Dispatch<
    SetStateAction<AuthMethod | undefined>
  > = () => {};
  useEffect(() => {
    try {
      localStorage.removeItem("last-used-auth-method");
    } catch {
      // storage unavailable
    }
  }, []);

  const [authMethod, setAuthMethod] = useState<AuthMethod | undefined>("email");

  useEffect(() => {
    const error = searchParams?.get("error");
    if (error) {
      toast.error(
        errorCodes[error] ||
          "An unexpected error occurred. Please try again later.",
      );
    }
  }, [searchParams]);

  // Reset the state when leaving the page
  useEffect(() => () => setClickedMethod(undefined), []);

  const authProviders: {
    method: AuthMethod;
    component: ComponentType;
    props?: Record<string, unknown>;
  }[] = [
    {
      method: "google",
      component: GoogleButton,
      props: { next },
    },
    {
      method: "github",
      component: GitHubButton,
    },
    {
      method: "email",
      component: EmailSignIn,
      props: { next },
    },
    {
      method: "saml",
      component: SSOSignIn,
    },
  ];

  const currentAuthProvider = authProviders.find(
    (provider) => provider.method === authMethod,
  );

  const AuthMethodComponent = currentAuthProvider?.component;

  const showEmailPasswordOnly = authMethod === "email" && showPasswordField;

  return (
    <LoginFormContext.Provider
      value={{
        authMethod,
        setAuthMethod,
        clickedMethod,
        showPasswordField,
        showSSOOption,
        setShowPasswordField,
        setClickedMethod,
        setLastUsedAuthMethod,
        setShowSSOOption,
      }}
    >
      <div className="flex flex-col gap-3">
        <AnimatedSizeContainer height>
          <div className="flex flex-col gap-3 p-1">
            {authMethod && (
              <div className="flex flex-col gap-3">
                {AuthMethodComponent && (
                  <AuthMethodComponent {...currentAuthProvider?.props} />
                )}

                <AuthMethodsSeparator />
              </div>
            )}

            {showEmailPasswordOnly ? (
              <div className="mt-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowPasswordField(false)}
                  text="Continue with another method"
                />
              </div>
            ) : (
              authProviders
                .filter(
                  (provider) =>
                    provider.method !== authMethod &&
                    methods.includes(provider.method),
                )
                .map((provider) => (
                  <div key={provider.method}>
                    <provider.component />
                  </div>
                ))
            )}
          </div>
        </AnimatedSizeContainer>
      </div>
    </LoginFormContext.Provider>
  );
}
