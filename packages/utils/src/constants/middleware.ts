import { APP_DOMAIN, WEBSITE_URL } from "./main";

export const DEFAULT_REDIRECTS = {
  home: WEBSITE_URL,
  dub: WEBSITE_URL,
  signin: `${APP_DOMAIN}/login`,
  login: `${APP_DOMAIN}/login`,
  register: `${APP_DOMAIN}/register`,
  signup: `${APP_DOMAIN}/register`,
  app: APP_DOMAIN,
  dashboard: APP_DOMAIN,
  links: `${APP_DOMAIN}/links`,
  settings: `${APP_DOMAIN}/settings`,
  welcome: `${APP_DOMAIN}/onboarding/welcome`,
  discord: "https://twitter.com/dubdotco", // placeholder for now
};

// BrewCC: short-link responses carry no platform-identifying headers
export const DUB_HEADERS: Record<string, string> = {};

export const REDIRECTION_QUERY_PARAM = "redir_url";
