import type { TranslationKey } from "@/lib/i18n";

type AuthLikeError = { code?: string | null; message?: string | null } | null | undefined;

const CODE_KEYS: Record<string, TranslationKey> = {
  weak_password: "auth.err.weakPassword",
  user_already_exists: "auth.err.userExists",
  email_exists: "auth.err.userExists",
  over_email_send_rate_limit: "auth.err.rateLimit",
  over_request_rate_limit: "auth.err.rateLimit",
  invalid_credentials: "auth.invalid",
  email_not_confirmed: "auth.err.notConfirmed",
  same_password: "auth.err.samePassword",
};

/** Turns an auth error into a user-facing message: known codes are translated, others show the service's message. */
export function authErrorMessage(error: AuthLikeError, t: (k: TranslationKey) => string): string {
  const code = error?.code ?? "";
  if (code && CODE_KEYS[code]) return t(CODE_KEYS[code]);
  const msg = error?.message?.trim();
  return msg ? msg : t("auth.genericError");
}
