// BrewCC: sender addresses use a domain verified in Resend (EMAIL_FROM_DOMAIN)
const EMAIL_FROM_DOMAIN = process.env.EMAIL_FROM_DOMAIN || "brewcc.online";

export const VARIANT_TO_FROM_MAP = {
  primary: `BrewCC <system@${EMAIL_FROM_DOMAIN}>`,
  notifications: `BrewCC <notifications@${EMAIL_FROM_DOMAIN}>`,
  marketing: `BrewCC <hello@${EMAIL_FROM_DOMAIN}>`,
};
