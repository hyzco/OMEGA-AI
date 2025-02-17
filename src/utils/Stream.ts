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

export const streamToObject = async (stream: ReadableStream): Promise<any> => {
  const reader = stream.getReader();
  let result = "";
  let done = false;

  while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (value) result += new TextDecoder().decode(value);
    done = streamDone;
  }

  return JSON.parse(result);
};
