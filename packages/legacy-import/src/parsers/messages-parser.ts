// M11 messages parser (clean-room). 消息记录.csv -> conversation/message rows
// (GF-STORE-014). Timestamps are converted by the writer via TimestampConverter.
import type { SourceItemRef } from "../types.js";
import { readFileSync } from "node:fs";
import { parseCsv } from "./csv-utils.js";

export interface MessageImportRow {
  product_id: string;
  time: string;
  buyer_name: string;
  question: string;
  ai_reply: string;
  chat_history: string;
  highest_similarity: string;
  agent_name: string;
}

export function parseMessagesCsv(item: SourceItemRef): { rows: MessageImportRow[]; fields: string[] } {
  const table = parseCsv(readFileSync(item.path, "utf-8"));
  const rows = table.rows.map((r) => ({
    product_id: String(r["商品ID"] ?? ""),
    time: String(r["时间"] ?? ""),
    buyer_name: String(r["买家名称"] ?? ""),
    question: String(r["问题"] ?? ""),
    ai_reply: String(r["AI回复"] ?? ""),
    chat_history: String(r["聊天记录"] ?? ""),
    highest_similarity: String(r["最高相似度"] ?? ""),
    agent_name: String(r["客服名称"] ?? ""),
  }));
  return { rows, fields: table.headers };
}
