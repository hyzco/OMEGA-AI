import { IterableReadableStream } from "@langchain/core/utils/stream";
import { ToolRegistry, IWorkflow, IWorkflowStep } from "./aiTools/ToolRegistry";
import { ToolExecutor } from "./aiTools/ToolExecutor";
import logger from "../utils/Logger";

export class WorkflowManager {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly toolExecutor: ToolExecutor
  ) {}

  async executeWorkflow(
    workflowId: string,
    initialInput: any
  ): Promise<IterableReadableStream<string>> {
    const workflow = this.toolRegistry.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    let currentOutput = { input: initialInput, output: null };
    const executionContext = {};

    for (const [index, step] of workflow.steps.entries()) {
      try {
        // Determine if the step requires array processing
        const requiresArrayProcessing = Object.values(step.inputMapping).some(
          (path) => typeof path === "string" && path.includes("$index")
        );

        if (requiresArrayProcessing) {
          // Identify and extract the array from the current output
          const arrayPath = Object.values(step.inputMapping).find(
            (path) => typeof path === "string" && path.includes("$index")
          );
          const basePath = arrayPath.replace(/\[\$index\].*/, "");
          const array = getValueFromPath(currentOutput, basePath);

          if (!Array.isArray(array)) {
            throw new Error(`Expected an array at path ${basePath}`);
          }

          const results = [];
          for (let i = 0; i < array.length; i++) {
            const mappedInput = this.prepareStepInput(
              step,
              currentOutput,
              executionContext,
              i
            );
            const toolOutput = await this.toolExecutor.executeTool(
              step.toolName,
              mappedInput
            );
            results.push(toolOutput);
          }
          executionContext[`step_${index}`] = {
            input: currentOutput.input,
            output: results,
          };
          currentOutput = { input: initialInput, output: results };
        } else {
          // Process a normal (non-array) step
          const mappedInput = this.prepareStepInput(
            step,
            currentOutput,
            executionContext
          );
          const toolOutput = await this.toolExecutor.executeTool(
            step.toolName,
            mappedInput
          );
          executionContext[`step_${index}`] = {
            input: mappedInput,
            output: toolOutput,
          };
          currentOutput = {
            input: Object.assign(initialInput, mappedInput),
            output: toolOutput,
          };
        }
      } catch (error: any) {
        logger.error(
          `Error in workflow step ${index} (${step.toolName}):`,
          error
        );
        throw new Error(
          `Workflow execution failed at step ${index}: ${error.message}`
        );
      }
    }

    // Convert the final output to a stream (implementation-specific)
    return this.convertResponseToStream(currentOutput.output);
  }

  createWorkflow(workflow: Omit<IWorkflow, "id">): string {
    // Validate that each step's input mapping corresponds with the tool's schema
    for (const step of workflow.steps) {
      const tool = this.toolRegistry.getTool(step.toolName);
      if (!tool) {
        throw new Error(`Tool ${step.toolName} not found in registry`);
      }
      if (step.inputMapping) {
        for (const targetKey of Object.keys(step.inputMapping)) {
          if (!tool.inputSchema.properties?.[targetKey]) {
            throw new Error(
              `Invalid input mapping: ${targetKey} not found in tool ${step.toolName}`
            );
          }
        }
      }
    }
    return this.toolRegistry.createWorkflow(workflow);
  }

  private prepareStepInput(
    step: IWorkflowStep,
    previousOutput: any,
    executionContext: any,
    index?: number
  ) {
    const inputMapping = step.inputMapping || {};
    const mappedInput: Record<string, any> = {};

    for (const [targetKey, sourcePath] of Object.entries(inputMapping)) {
      const resolvedPath =
        typeof sourcePath === "string"
          ? sourcePath.replace("$index", index?.toString() || "0")
          : sourcePath;

      if (
        typeof resolvedPath === "string" &&
        resolvedPath.startsWith("context.")
      ) {
        const contextPath = resolvedPath.replace("context.", "");
        mappedInput[targetKey] = getValueFromPath(
          executionContext,
          contextPath
        );
      } else if (
        typeof resolvedPath === "string" &&
        resolvedPath.startsWith("output.")
      ) {
        const outputPath = resolvedPath.replace("output.", "");
        mappedInput[targetKey] = getValueFromPath(
          previousOutput.output,
          outputPath
        );
      } else if (
        typeof resolvedPath === "string" &&
        resolvedPath.startsWith("input.")
      ) {
        const inputPath = resolvedPath.replace("input.", "");
        mappedInput[targetKey] = getValueFromPath(
          previousOutput.input,
          inputPath
        );
      } else {
        mappedInput[targetKey] = resolvedPath;
      }
    }
    return mappedInput;
  }

  private convertResponseToStream(
    response: any
  ): IterableReadableStream<string> {
    // Implement conversion to stream as required by your application
    throw new Error("convertResponseToStream not implemented");
  }
}

// Utility function to resolve nested paths (supports array indices)
function getValueFromPath(obj: any, path: string) {
  return path.split(".").reduce((acc, part) => {
    const arrayIndexMatch = part.match(/(\w+)\[(\d+)\]/);
    if (arrayIndexMatch) {
      const arrayName = arrayIndexMatch[1];
      const index = parseInt(arrayIndexMatch[2], 10);
      if (!acc[arrayName] || !Array.isArray(acc[arrayName])) {
        throw new Error(`Path resolution failed at ${part}`);
      }
      return acc[arrayName][index];
    }
    if (acc === null || acc === undefined) {
      throw new Error(`Path resolution failed at ${part}`);
    }
    return acc[part];
  }, obj);
}
