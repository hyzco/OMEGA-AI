import { jsonrepair } from "jsonrepair";

export function extractJSON(str: string): any | null {
  let firstOpen = 0,
    firstClose = 0,
    candidate = null;
  firstOpen = str.indexOf("{", firstOpen + 1);
  do {
    firstClose = str.lastIndexOf("}");
    if (firstClose <= firstOpen) {
      return null;
    }
    do {
      candidate = str.substring(firstOpen, firstClose + 1);
      try {
        const repairedJson = jsonrepair(candidate);
        const res = JSON.parse(repairedJson);
        return res;
      } catch (e) {
        // Continue trying with a shorter substring.
      }
      firstClose = str.substring(0, firstClose).lastIndexOf("}");
    } while (firstClose > firstOpen);
    firstOpen = str.indexOf("{", firstOpen + 1);
  } while (firstOpen !== -1);
  return null;
}
