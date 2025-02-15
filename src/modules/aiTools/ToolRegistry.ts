import { JSONSchema7 } from "json-schema";
import { v4 as uuidv4 } from "uuid";
import { ITool } from "./AiTools";
import { IterableReadableStream } from "@langchain/core/utils/stream";

// --- Interfaces ---
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

// --- Registry Class ---
export class ToolRegistry {
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
