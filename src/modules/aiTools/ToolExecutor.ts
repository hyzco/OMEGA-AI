import Ajv from "ajv";
import { ToolRegistry } from "./ToolRegistry";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import { convertResponseToString } from "../../utils/Stream";

const ajv = new Ajv();

export class ToolExecutor {
  constructor(private readonly toolRegistry: ToolRegistry) {}

  async executeTool(
    toolName: string,
    input: any
  ): Promise<IterableReadableStream<string>> {
    const tool = this.toolRegistry.getTool(toolName);
    if (!tool) throw new Error(`Tool ${toolName} not found`);

    // Validate input against the tool's input schema
    const validate = ajv.compile(tool.inputSchema);
    if (!validate(input)) {
      throw new Error(
        `Invalid input for tool ${toolName}: ${JSON.stringify(validate.errors)}`
      );
    }

    // Set the tool arguments (if your tool expects this)
    tool.interface.toolArgs = input;
    console.log("tool.interface", tool.interface);

    // Execute the tool
    const result = await tool.handler(tool.interface);
    // Validate the tool's output
    const outputValidate = ajv.compile(tool.outputSchema);
    if (!outputValidate(result)) {
      throw new Error(
        `Invalid output from tool ${toolName}: ${JSON.stringify(
          outputValidate.errors
        )}`
      );
    }
    return result;
  }
}
