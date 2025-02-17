import { IterableReadableStream } from "@langchain/core/utils/stream";
import { ToolRegistry, IWorkflow, IWorkflowStep } from "./aiTools/ToolRegistry";
import { ToolExecutor } from "./aiTools/ToolExecutor";
import logger from "../utils/Logger";
import { convertResponseToStream } from "../utils/Stream";

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
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    let currentOutput = { input: initialInput, output: null };
    const executionContext = {};

    for (const [index, step] of workflow.steps.entries()) {
      try {
        if (this.requiresArrayProcessing(step)) {
          const array = this.extractArrayFromOutput(currentOutput, step);
          const results = await this.processArrayStep(
            step,
            array,
            currentOutput,
            executionContext,
            index
          );
          executionContext[`step_${index}`] = {
            input: currentOutput.input,
            output: results,
          };
          currentOutput = {
            input: { ...initialInput, ...currentOutput.input, ...results }, // Preserve initial input and merge results
            output: results,
          };
        } else {
          const mappedInput = this.prepareStepInput(
            step,
            currentOutput,
            executionContext
          );
          const toolOutput = await this.toolExecutor.executeToolWithJsonOutput(
            step.toolName,
            { ...initialInput, ...currentOutput.input, ...mappedInput } // Preserve initial input and merge mapped input
          );
          executionContext[`step_${index}`] = {
            input: mappedInput,
            output: toolOutput,
          };
          currentOutput = {
            input: { ...initialInput, ...currentOutput.input, ...toolOutput }, // Preserve initial input and merge tool output
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

    return convertResponseToStream(currentOutput.output);
  }

  createWorkflow(workflow: Omit<IWorkflow, "id">): string {
    for (const step of workflow.steps) {
      const tool = this.toolRegistry.getTool(step.toolName);
      if (!tool) throw new Error(`Tool ${step.toolName} not found in registry`);
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

  private requiresArrayProcessing(step: IWorkflowStep): boolean {
    return Object.values(step.inputMapping).some(
      (path) => typeof path === "string" && path.includes("$index")
    );
  }

  private extractArrayFromOutput(
    currentOutput: any,
    step: IWorkflowStep
  ): any[] {
    const arrayPath = Object.values(step.inputMapping).find(
      (path) => typeof path === "string" && path.includes("$index")
    ) as string;
    const basePath = arrayPath.replace(/\[\$index\].*/, "");
    const array = getValueFromPath(currentOutput, basePath);
    if (!Array.isArray(array))
      throw new Error(`Expected an array at path ${basePath}`);
    return array;
  }

  private async processArrayStep(
    step: IWorkflowStep,
    array: any[],
    currentOutput: any,
    executionContext: any,
    stepIndex: number
  ): Promise<any[]> {
    const results = [];
    for (let i = 0; i < array.length; i++) {
      const mappedInput = this.prepareStepInput(
        step,
        currentOutput,
        executionContext,
        i
      );
      const toolOutput = await this.toolExecutor.executeToolWithJsonOutput(
        step.toolName,
        mappedInput
      );
      results.push(toolOutput);
    }
    return results;
  }

  private prepareStepInput(
    step: IWorkflowStep,
    previousOutput: any,
    executionContext: any,
    index?: number
  ): Record<string, any> {
    const inputMapping = step.inputMapping || {};
    const mappedInput: Record<string, any> = {};
    for (const [targetKey, sourcePath] of Object.entries(inputMapping)) {
      const resolvedPath =
        typeof sourcePath === "string"
          ? sourcePath.replace("$index", index?.toString() || "0")
          : sourcePath;
      mappedInput[targetKey] = this.resolvePath(
        resolvedPath,
        previousOutput,
        executionContext
      );
    }
    return mappedInput;
  }

  private resolvePath(
    path: string,
    previousOutput: any,
    executionContext: any
  ): any {
    if (path.startsWith("context."))
      return getValueFromPath(executionContext, path.replace("context.", ""));
    if (path.startsWith("output."))
      return getValueFromPath(
        previousOutput.output,
        path.replace("output.", "")
      );
    if (path.startsWith("input."))
      return getValueFromPath(previousOutput.input, path.replace("input.", ""));
    return path;
  }
}

export function getValueFromPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => {
    if (acc === null || acc === undefined) {
      throw new Error(`Path resolution failed at ${part}`);
    }

    // Handle array indices (e.g., "ideas[0].idea")
    const arrayIndexMatch = part.match(/(\w+)\[(\d+)\]/);
    if (arrayIndexMatch) {
      const arrayName = arrayIndexMatch[1];
      const index = parseInt(arrayIndexMatch[2], 10);
      if (!acc || typeof acc !== "object" || !(arrayName in acc)) {
        logger.warn(`Path resolution warning: ${arrayName} not found in`, acc);
        return undefined;
      }
      if (!Array.isArray(acc[arrayName])) {
        logger.warn(
          `Expected an array at path ${arrayName}, but found`,
          acc[arrayName]
        );
        return undefined;
      }
      return acc[arrayName][index];
    }

    // Handle direct property access (e.g., "ideas")
    if (Array.isArray(acc)) {
      // If the current accumulator is an array, map over it to resolve the path for each item
      return acc.map((item) => item[part]);
    }

    // Default case: access property
    return acc[part];
  }, obj);
}
