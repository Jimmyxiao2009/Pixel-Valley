/** API-only. Never import from apps/web; never put on the wire. */
export interface AccountSecret {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}
