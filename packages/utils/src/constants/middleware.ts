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

export const DUB_HEADERS = {
  "x-powered-by": "Dub - The Modern Link Attribution Platform",
};

export const REDIRECTION_QUERY_PARAM = "redir_url";
