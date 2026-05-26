export const APP_NAME = "JomSplit";
export const APP_TAGLINE = "Jom split, no awkward chasing.";
export const APP_DESCRIPTION =
  "Create a bill, share one link, watch it settle. Built for Malaysian group chats.";

export const SUPPORTED_CURRENCIES = ["MYR"] as const;
export const DEFAULT_CURRENCY: (typeof SUPPORTED_CURRENCIES)[number] = "MYR";

export const LIMITS = {
  billTitle: 100,
  billDescription: 500,
  memberName: 50,
  memberCount: 50,
  totalAmountCents: 1_000_000_00,
} as const;

export const SLUG_LENGTH = 8;
export const MEMBER_TOKEN_LENGTH = 16;
export const SLUG_RETRY_ATTEMPTS = 3;

export const CLAIM_COOKIE_NAME = "jms_claim";
export const CLAIM_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const THEME_STORAGE_KEY = "jomsplit:theme";
export const THEME_VALUES = ["light", "dark", "system"] as const;
export type ThemeValue = (typeof THEME_VALUES)[number];

export const BILL_STATUS = ["open", "settled", "archived"] as const;
export type BillStatus = (typeof BILL_STATUS)[number];
