import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./auth-errors";
import { en } from "./i18n/en";

const t = (k: keyof typeof en) => en[k];

describe("authErrorMessage", () => {
  it("translates weak password code", () => {
    expect(authErrorMessage({ code: "weak_password", message: "x" }, t)).toBe(en["auth.err.weakPassword"]);
  });
  it("shows the service message for unknown codes", () => {
    expect(authErrorMessage({ code: "something_new", message: "Password is known to be weak and easy to guess, please choose a different one." }, t))
      .toBe("Password is known to be weak and easy to guess, please choose a different one.");
  });
  it("falls back to generic text when there is no message", () => {
    expect(authErrorMessage({}, t)).toBe(en["auth.genericError"]);
  });
});
