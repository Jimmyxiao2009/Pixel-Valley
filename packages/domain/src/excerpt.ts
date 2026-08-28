/** CJK unified ideographs + fullwidth punctuation weigh 2 units (§3.3). */
const CJK_PUNCT = /[\u3000-\u303f\uff00-\uffef]/u;
const CJK_IDEOGRAPH =
  /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{2ceaf}]/u;
const EMOJI = /\p{Extended_Pictographic}/u;
const PUNCT = new Set(["。", "！", "？", "；", "，", "、", ".", "!", "?"]);
const ELLIPSIS = "…";
const MAX_UNITS = 36;

export type ExcerptOptions = {
  hasImage?: boolean;
};

function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return Array.from(new Intl.Segmenter("zh", { granularity: "grapheme" }).segment(text), (part) => part.segment);
  }
  return Array.from(text);
}

export function graphemeUnits(grapheme: string): number {
  if (EMOJI.test(grapheme) || CJK_IDEOGRAPH.test(grapheme) || CJK_PUNCT.test(grapheme)) {
    return 2;
  }
  return 1;
}

export function excerptUnits(text: string): number {
  return graphemes(text).reduce((sum, part) => sum + graphemeUnits(part), 0);
}

/** Alias kept so both call sites (§3.3 excerpt work and the API feed work) share one implementation. */
export const countUnits = excerptUnits;
export const graphemeUnit = graphemeUnits;

function isPunctGrapheme(grapheme: string): boolean {
  return PUNCT.has(grapheme);
}

export function excerpt(text: string, options: ExcerptOptions = {}): string {
  const source = text.trim();
  if (source.length === 0) {
    return options.hasImage ? "（一张图）" : "（空）";
  }

  const parts = graphemes(source);
  const weights = parts.map(graphemeUnits);

  let end = 0;
  let used = 0;
  while (end < parts.length) {
    const next = weights[end] ?? 1;
    if (used + next > MAX_UNITS) {
      break;
    }
    used += next;
    end += 1;
  }

  const truncated = end < parts.length;
  if (!truncated) {
    return parts.join("");
  }

  // Cut sits at most 4 units before a punct → snap after it if still ≤36.
  let gap = 0;
  for (let index = end; index < parts.length; index += 1) {
    const part = parts[index] ?? "";
    const weight = weights[index] ?? 1;
    if (isPunctGrapheme(part)) {
      if (gap <= 4 && used + gap + weight <= MAX_UNITS) {
        used += gap + weight;
        end = index + 1;
      }
      break;
    }
    gap += weight;
    if (gap > 4) {
      break;
    }
  }

  const ellipsisUnits = graphemeUnits(ELLIPSIS);
  while (end > 0 && used + ellipsisUnits > MAX_UNITS) {
    end -= 1;
    used -= weights[end] ?? 1;
  }

  return `${parts.slice(0, end).join("")}${ELLIPSIS}`;
}
