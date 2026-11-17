// BrewCC/BrewCC: Cloudflare Turnstile (CAPTCHA) for password login and sign-up.
// Off until both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are set, so the
// login flow keeps working before the keys exist. Google/GitHub logins don't need it.

export const isTurnstileEnabled = () =>
  Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY &&
      process.env.TURNSTILE_SECRET_KEY,
  );

export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string | null,
): Promise<boolean> {
  if (!isTurnstileEnabled()) return true;
  if (!token) return false;

  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY as string,
    response: token,
    ...(ip && ip !== "0.0.0.0" && { remoteip: ip }),
  });

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body, signal: AbortSignal.timeout(8000) },
    );
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    // Cloudflare unreachable: don't lock everyone out; rate limits still apply
    console.error("[turnstile] verification unavailable", error);
    return true;
  }
}
