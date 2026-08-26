import type { AccountSecret } from "@pixel-valley/domain/secret";
import {
  ACCOUNT_AVA,
  ACCOUNT_LIN,
  ACCOUNT_NEKO,
  ACCOUNT_YOU,
  type DemoPersona,
} from "@pixel-valley/domain";

export const SESSION_COOKIE = "pv_session";
export const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

export type SessionRecord = {
  accountId: string;
  residentId: string;
};

const PERSONA_TO_ACCOUNT: Record<DemoPersona, { accountId: string; residentId: string }> = {
  you: { accountId: ACCOUNT_YOU, residentId: "you" },
  lin: { accountId: ACCOUNT_LIN, residentId: "lin" },
};

export function personaSession(persona: DemoPersona): SessionRecord {
  return PERSONA_TO_ACCOUNT[persona];
}

export function createDemoAccounts(createdAt: string): AccountSecret[] {
  return [
    {
      id: ACCOUNT_YOU,
      email: "you@pixel-valley.local",
      passwordHash: "seed-hash-you-not-for-wire",
      createdAt,
    },
    {
      id: ACCOUNT_LIN,
      email: "lin@pixel-valley.local",
      passwordHash: "seed-hash-lin-not-for-wire",
      createdAt,
    },
    {
      id: ACCOUNT_NEKO,
      email: "neko@pixel-valley.local",
      passwordHash: "seed-hash-neko-not-for-wire",
      createdAt,
    },
    {
      id: ACCOUNT_AVA,
      email: "ava@pixel-valley.local",
      passwordHash: "seed-hash-ava-not-for-wire",
      createdAt,
    },
  ];
}

export function toAccountPublic(account: AccountSecret) {
  return {
    id: account.id,
    email: account.email,
    createdAt: account.createdAt,
  };
}
