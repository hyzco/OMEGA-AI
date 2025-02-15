import { BaseMessageChunk } from "@langchain/core/messages";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import { extractJSON } from "./JSON";

export const convertResponseToString = async (
  response: string | IterableReadableStream<string | BaseMessageChunk>,
  isJSON = false
) => {
  let responseString = "";
  let buffer = "";

  for await (const chunk of response) {
    const chunkContent =
      typeof chunk === "string" ? chunk : (chunk as BaseMessageChunk).content;

    buffer += chunkContent;

    process.stdout.write(buffer.toString()); // Output only processed content
    responseString += buffer;
    buffer = ""; // Clear buffer after processing
  }

  console.log();

  if (isJSON) {
    responseString = extractJSON(responseString);
  }

  return responseString;
};

export const convertResponseToStream = async (
  response: string
): Promise<IterableReadableStream<string>> => {
  return new IterableReadableStream<string>({
    start(controller) {
      controller.enqueue(response);
      controller.close();
    },
  });
};
