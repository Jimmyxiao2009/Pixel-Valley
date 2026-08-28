import type { MessageGateView } from "./types.ts";

export type GateDenialCode = Extract<MessageGateView, { ok: false }>["code"];

/** §15.4 CTA labels for whichever door the server opened. */
export function messageActionText(via: "knock" | "note"): string {
  return via === "knock" ? "敲门" : "留一张纸条";
}

/**
 * §4.4 / §15.4 refusal copy. Internal gate codes (blocked / forbidden / dnd)
 * must never reach a resident's eyes, so every surface renders through here
 * instead of writing its own mapping.
 *
 * `blocking` distinguishes the two sides of a block: we tell you when *you*
 * put up the wall, but a resident who blocked you is indistinguishable from
 * one who simply does not take visitors.
 */
export function gateRefusalText(
  code: GateDenialCode,
  options: { blocking?: boolean } = {},
): string {
  if (options.blocking) {
    return "你挡住了 Ta";
  }
  if (code === "dnd") {
    return "门口挂了牌子，先留纸条";
  }
  return "这家谢绝访客";
}

/** Copy for a send that the server refused after the thread already existed. */
export function sendRefusalText(
  code: GateDenialCode,
  options: { blocking?: boolean } = {},
): string {
  if (options.blocking) {
    return "你挡住了 Ta。先取消，才能再说话。";
  }
  if (code === "dnd") {
    return "门口挂了牌子。这句话送不进去。";
  }
  return "这扇门现在关着。这句话没送出去。";
}
