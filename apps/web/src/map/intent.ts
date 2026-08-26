import type { BubbleView, DerivedSlotKind } from "@pixel-valley/domain";
import { isOccupiedLot, type HitAction } from "./hitTest";

export type MapUi =
  | { type: "home" }
  | { type: "peek"; residentId: string }
  | { type: "post"; postId: string; residentId: string }
  | { type: "bus" }
  | { type: "vacant" };

export type MapIntent = {
  ui?: MapUi;
  walkTo?: number;
};

export type MapIntentHandlers = {
  openUi: (ui: MapUi) => void;
  walkTo: (slotIndex: number) => void | Promise<void>;
};

export type IntentLot = {
  slotIndex: number;
  kind: DerivedSlotKind;
  residentId: string | null;
};

export function intentFromHit(
  action: HitAction,
  lot: IntentLot,
  bubble?: BubbleView,
  meId?: string,
): MapIntent {
  const walkTo = lot.slotIndex;
  if (action === "post" && bubble) {
    return {
      ui: { type: "post", postId: bubble.postId, residentId: lot.residentId ?? bubble.residentId },
      walkTo,
    };
  }
  if (action === "peek" && lot.residentId) {
    if (lot.kind === "self" || lot.residentId === meId) {
      return { ui: { type: "home" }, walkTo };
    }
    return { ui: { type: "peek", residentId: lot.residentId }, walkTo };
  }
  if (action === "vacant") {
    return { ui: { type: "vacant" }, walkTo };
  }
  if (action === "bus") {
    return { ui: { type: "bus" }, walkTo };
  }
  if (action === "walk") {
    return { walkTo };
  }
  return {};
}

export function occupiedIntent(lot: IntentLot, meId?: string): MapIntent {
  if (!isOccupiedLot(lot.kind) || !lot.residentId) {
    return { walkTo: lot.slotIndex };
  }
  if (lot.kind === "self" || lot.residentId === meId) {
    return { ui: { type: "home" }, walkTo: lot.slotIndex };
  }
  return { ui: { type: "peek", residentId: lot.residentId }, walkTo: lot.slotIndex };
}

export function bubbleIntent(lot: IntentLot, bubble: BubbleView): MapIntent {
  return {
    ui: { type: "post", postId: bubble.postId, residentId: lot.residentId ?? bubble.residentId },
    walkTo: lot.slotIndex,
  };
}

/**
 * Open UI at t=0. Walking is fire-and-forget so the caller never waits on lerp.
 */
export function dispatchMapIntent(intent: MapIntent, handlers: MapIntentHandlers): void {
  if (intent.ui) {
    handlers.openUi(intent.ui);
  }
  if (intent.walkTo !== undefined) {
    void handlers.walkTo(intent.walkTo);
  }
}
