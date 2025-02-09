import { JSONSchema7 } from "json-schema";
import { v4 as uuidv4 } from "uuid";
import { WebSocket } from "ws";
import WebSocketModule, { WebSocketMessage } from "./modules/WebSocketModule";
import logger from "./utils/Logger";
import Ajv from "ajv";
import { ITool } from "./modules/aiTools/AiTools";
import RAG from "./RAG";
import { IterableReadableStream } from "@langchain/core/utils/stream";
const ajv = new Ajv();

// Enhanced Interfaces
export interface IToolConfig {
  interface: ITool;
  inputSchema: JSONSchema7;
  outputSchema: JSONSchema7;
  handler: (input: any) => Promise<IterableReadableStream<string>>;
}

export interface IDataSource {
  name: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  query: (params: any) => Promise<any>;
}

export interface IWorkflowStep {
  toolName: string;
  inputMapping: Record<string, string>;
}

export interface IWorkflow {
  id: string;
  name: string;
  description: string;
  steps: IWorkflowStep[];
}

// Generic Registry Classes
export class DynamicToolRegistry {
  private readonly tools = new Map<string, IToolConfig>();
  private readonly dataSources = new Map<string, IDataSource>();
  private readonly workflows = new Map<string, IWorkflow>();

  registerTool(tool: IToolConfig) {
    this.tools.set(tool.interface.toolName, tool);
  }

  registerDataSource(source: IDataSource) {
    this.dataSources.set(source.name, source);
  }

  createWorkflow(workflow: Omit<IWorkflow, "id">) {
    const id = uuidv4();
    this.workflows.set(id, { ...workflow, id });
    return id;
  }

  getTool(name: string) {
    return this.tools.get(name);
  }

  getDataSource(name: string) {
    return this.dataSources.get(name);
  }

  getWorkflow(id: string) {
    return this.workflows.get(id);
  }

  getWorkflows() {
    return this.workflows;
  }

  getWorkflowByName(name: string) {
    return Array.from(this.workflows.values()).find(
      (workflow) => workflow.name === name
    );
  }
}

// Enhanced ContentAI Class
export default class DynamicRAGBuilder extends RAG {
  protected readonly toolRegistry = new DynamicToolRegistry();
  protected readonly webSocketModule: WebSocketModule;
  private readonly activeSessions = new Map<string, WebSocket>();

  constructor() {
    super();

    this.webSocketModule = new WebSocketModule(5555);
    this.webSocketModule.initializeWebSocket(
      this.handleWebSocketMessage.bind(this)
    );
  }

  // Generic Message Handling
  private async handleWebSocketMessage(
    message: WebSocketMessage,
    ws: WebSocket
  ) {
    try {
      const sessionId = uuidv4();
      this.activeSessions.set(sessionId, ws);

      switch (message.type) {
        case "EXECUTE_TOOL":
          await this.handleToolExecution(message, sessionId);
          break;
        case "CREATE_WORKFLOW":
          await this.handleWorkflowCreation(message, sessionId);
          break;
        case "EXECUTE_WORKFLOW":
          await this.handleWorkflowExecution(message, sessionId);
          break;
        default:
          this.sendError(sessionId, "Unsupported message type");
      }
    } catch (error) {
      logger.error("WebSocket handling error:", error);
      //   this.sendError(sessionId, error.message);
    }
  }

  // Tool Execution
  protected async executeTool(toolName: string, input: any) {
    const tool = this.toolRegistry.getTool(toolName);
    tool.interface.toolArgs = input;

    if (!tool) throw new Error(`Tool ${toolName} not found`);
    // Validate input against schema
    const validate = ajv.compile(tool.inputSchema);
    if (!validate(input)) {
      throw new Error(
        `Invalid input for tool ${toolName}: ${JSON.stringify(validate.errors)}`
      );
    }

    // Execute tool
    const result = await tool.handler(tool.interface);

    // Validate output
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

  // Workflow Management

  async executeWorkflow(
    workflowId: string,
    initialInput: any
  ): Promise<IterableReadableStream<string>> {
    const workflow = this.toolRegistry.getWorkflows().get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    let currentOutput = { input: initialInput, output: null };
    const executionContext = {};

    for (const [index, step] of workflow.steps.entries()) {
      try {
        const tool = this.toolRegistry.getTool(step.toolName);
        tool.interface.toolArgs = currentOutput.input;

        if (!tool) {
          throw new Error(`Tool ${step.toolName} not found`);
        }

        // Check if the input mapping contains $index (indicating array processing)
        const requiresArrayProcessing = Object.values(
          step.inputMapping || {}
        ).some((path) => typeof path === "string" && path.includes("$index"));

        if (requiresArrayProcessing) {
          // Find the array to process (e.g., output.ideas)
          const arrayPath = Object.values(step.inputMapping || {}).find(
            (path) => typeof path === "string" && path.includes("$index")
          ) as string;

          // Extract the base path (e.g., output.ideas) without [$index]
          const basePath = arrayPath.replace(/\[\$index\].*/, "");

          // Extract the array from the current output
          const array = getValueFromPath(currentOutput, basePath);

          if (!Array.isArray(array)) {
            throw new Error(
              `Expected an array at path ${basePath}, but got ${typeof array}`
            );
          }

          const results = [];

          // Process each item in the array
          for (let i = 0; i < array.length; i++) {
            const item = array[i];

            // Preserve the full array structure in previousOutput
            const previousOutputWithArray = {
              input: currentOutput.input,
              output: {
                ...currentOutput.output, // Retain the full output structure
                [basePath]: array, // Ensure the array is accessible
                currentItem: item, // Add the current item for easy access
              },
            };

            // Prepare input for the current step
            const mappedInput = this.prepareStepInput(
              step,
              previousOutputWithArray,
              executionContext,
              i // Pass the index for dynamic replacement
            );

            // Execute the tool for the current item
            const toolOutput = await this.convertResponseToString(
              await this.executeTool(step.toolName, mappedInput),
              true
            );

            results.push(toolOutput);
          }

          // Update execution context with all results
          executionContext[`step_${index}`] = {
            input: currentOutput.input,
            output: results,
          };

          // Prepare for next step
          currentOutput = {
            input: initialInput,
            output: results,
          };
        } else {
          // Handle non-array steps
          const mappedInput = this.prepareStepInput(
            step,
            currentOutput,
            executionContext
          );

          const toolOutput = await this.convertResponseToString(
            await this.executeTool(step.toolName, mappedInput),
            true
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
      } catch (error) {
        logger.error(
          `Error in workflow step ${index} (${step.toolName}):`,
          error
        );
        throw new Error(
          `Workflow execution failed at step ${index}: ${error.message} ${error.stack}`
        );
      }
    }

    // Return the final output as a stream
    return this.convertResponseToStream(currentOutput.output);
  }

  private prepareStepInput(
    step: IWorkflowStep,
    previousOutput: any,
    executionContext: any,
    index?: number // Optional index for dynamic iteration
  ) {
    const inputMapping = step.inputMapping || {};
    const mappedInput = {};

    for (const [targetKey, sourcePath] of Object.entries(inputMapping)) {
      try {
        // Replace $index with the actual index if provided
        const resolvedPath =
          typeof sourcePath === "string"
            ? sourcePath.replace("$index", index?.toString() || "0")
            : sourcePath;

        // Handle special context references
        if (
          typeof resolvedPath === "string" &&
          resolvedPath.startsWith("context.")
        ) {
          const contextPath = resolvedPath.replace("context.", "");
          mappedInput[targetKey] = getValueFromPath(
            executionContext,
            contextPath
          );
        }
        // Handle previous output references
        else if (
          typeof resolvedPath === "string" &&
          resolvedPath.startsWith("output.")
        ) {
          const outputPath = resolvedPath.replace("output.", "");
          mappedInput[targetKey] = getValueFromPath(
            previousOutput.output,
            outputPath
          );
        }
        // Handle direct input references
        else if (
          typeof resolvedPath === "string" &&
          resolvedPath.startsWith("input.")
        ) {
          const inputPath = resolvedPath.replace("input.", "");
          mappedInput[targetKey] = getValueFromPath(
            previousOutput.input,
            inputPath
          );
        }
        // Handle literal values
        else {
          mappedInput[targetKey] = resolvedPath;
        }
      } catch (error) {
        logger.error(`Error mapping input for ${targetKey}:`, error);
        throw new Error(
          `Failed to map input for ${targetKey}: ${error.message}`
        );
      }
    }

    return mappedInput;
  }

  // Enhanced workflow creation with input/output validation
  createWorkflow(workflow: Omit<IWorkflow, "id">): string {
    // Validate workflow steps
    for (const step of workflow.steps) {
      const tool = this.toolRegistry.getTool(step.toolName);
      if (!tool) {
        throw new Error(`Tool ${step.toolName} not found in registry`);
      }

      // Validate input mappings
      if (step.inputMapping) {
        for (const [targetKey, sourcePath] of Object.entries(
          step.inputMapping
        )) {
          if (!tool.inputSchema.properties?.[targetKey]) {
            throw new Error(
              `Invalid input mapping: ${targetKey} not found in tool ${step.toolName}`
            );
          }
        }
      }
    }

    const id = uuidv4();
    this.toolRegistry.getWorkflows().set(id, { ...workflow, id });
    return id;
  }

  // Message Handlers
  private async handleToolExecution(
    message: WebSocketMessage,
    sessionId: string
  ) {
    const { toolName, input } = message.data;
    try {
      const result = await this.executeTool(toolName, input);
      this.sendSuccess(sessionId, result);
    } catch (error) {
      this.sendError(sessionId, error.message);
    }
  }

  private async handleWorkflowExecution(
    message: WebSocketMessage,
    sessionId: string
  ) {
    const { workflowId, input } = message.data;
    try {
      const result = await this.executeWorkflow(workflowId, input);
      this.sendSuccess(sessionId, result);
    } catch (error) {
      this.sendError(sessionId, error.message);
    }
  }

  private async handleWorkflowCreation(
    message: WebSocketMessage,
    sessionId: string
  ) {
    const workflowConfig = message.data;
    try {
      const workflowId = this.toolRegistry.createWorkflow(workflowConfig);
      this.sendSuccess(sessionId, { workflowId });
    } catch (error) {
      this.sendError(sessionId, error.message);
    }
  }

  // Helper Methods
  private sendSuccess(sessionId: string, data: any) {
    const ws = this.activeSessions.get(sessionId);
    if (ws) {
      ws.send(JSON.stringify({ status: "success", data }));
      this.activeSessions.delete(sessionId);
    }
  }

  private sendError(sessionId: string, message: string) {
    const ws = this.activeSessions.get(sessionId);
    if (ws) {
      ws.send(JSON.stringify({ status: "error", message }));
      this.activeSessions.delete(sessionId);
    }
  }
}

// Utility Functions
function getValueFromPath(obj: any, path: string) {
  return path.split(".").reduce((acc, part) => {
    // Handle array indices (e.g., "ideas[0]")
    const arrayIndexMatch = part.match(/(\w+)\[(\d+)\]/);
    if (arrayIndexMatch) {
      const arrayName = arrayIndexMatch[1];
      const index = parseInt(arrayIndexMatch[2], 10);
      if (acc === null || acc === undefined || !Array.isArray(acc[arrayName])) {
        throw new Error(`Path resolution failed at ${part}`);
      }
      return acc[arrayName][index];
    }

    // Handle regular properties
    if (acc === null || acc === undefined) {
      throw new Error(`Path resolution failed at ${part}`);
    }
    return acc[part];
  }, obj);
}
