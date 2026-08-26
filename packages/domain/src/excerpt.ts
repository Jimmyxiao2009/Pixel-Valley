const PUNCT = new Set(["。", "！", "？", "；", "，", "、", ".", "!", "?"]);

const segmenter = new Intl.Segmenter("zh", { granularity: "grapheme" });

function isCjkOrFullwidth(char: string): boolean {
  if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u.test(char)) {
    return true;
  }
  const code = char.codePointAt(0);
  if (code === undefined) {
    return false;
  }
  return (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef);
}

function isEmojiGrapheme(segment: string): boolean {
  return /\p{Extended_Pictographic}/u.test(segment);
}

export function graphemeUnit(segment: string): number {
  if (isEmojiGrapheme(segment)) {
    return 2;
  }
  for (const char of segment) {
    if (isCjkOrFullwidth(char)) {
      return 2;
    }
  }
  return 1;
}

export function countUnits(text: string): number {
  let total = 0;
  for (const { segment } of segmenter.segment(text)) {
    total += graphemeUnit(segment);
  }
  return total;
}

function graphemesOf(text: string): string[] {
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

export function excerpt(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "（空）";
  }

  const graphemes = graphemesOf(trimmed);
  const costs = graphemes.map(graphemeUnit);

  let units = 0;
  let end = 0;
  while (end < graphemes.length && units + costs[end]! <= 36) {
    units += costs[end]!;
    end += 1;
  }

  if (end >= graphemes.length) {
    return graphemes.join("");
  }

  let look = 0;
  for (let j = end; j < graphemes.length; j += 1) {
    const cost = costs[j]!;
    if (look + cost > 4) {
      break;
    }
    if (PUNCT.has(graphemes[j]!)) {
      if (units + cost <= 36) {
        end = j + 1;
        units += cost;
      }
      break;
    }
    look += cost;
  }

  while (units + 1 > 36 && end > 0) {
    end -= 1;
    units -= costs[end]!;
  }

  return `${graphemes.slice(0, end).join("")}…`;
}
