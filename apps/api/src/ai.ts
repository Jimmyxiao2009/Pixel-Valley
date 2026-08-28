import type { Message, Resident } from "@pixel-valley/domain";

const TEMPLATES: Record<string, string> = {
  qinghe: "慢慢走就好。电脑前写一句，出门就能看见。",
  nanfeng: "这本书可以先从目录翻起，不必一次读完。",
  mobai: "把句子写短一点，公告栏会更干净。",
  lulu: "下一班去镇中心。抓好扶手。",
  doumiao: "我在坐垫上。你写完了吗？",
};

export function mockAiReply(ai: Resident, _history: Message[]): string {
  void _history;
  const key = ai.aiMetadata?.systemPromptKey ?? ai.handle;
  return TEMPLATES[key] ?? "嗯。";
}
