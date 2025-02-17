import RAG from "./RAG";
import WebSocketModule from "./modules/WebSocketModule";
import { ToolRegistry } from "./modules/aiTools/ToolRegistry";
import { ToolExecutor } from "./modules/aiTools/ToolExecutor";
import { WorkflowManager } from "./modules/WorkFlowManager";
import { WebSocketHandler } from "./modules/WebSocketHandler";

export default class DynamicRAGBuilder extends RAG {
  protected readonly toolRegistry: ToolRegistry;
  protected readonly toolExecutor: ToolExecutor;
  protected readonly workflowManager: WorkflowManager;
  private readonly webSocketModule: WebSocketModule;
  private readonly webSocketHandler: WebSocketHandler;

  constructor() {
    super();
    this.toolRegistry = new ToolRegistry();
    this.toolExecutor = new ToolExecutor(this.toolRegistry);
    this.workflowManager = new WorkflowManager(
      this.toolRegistry,
      this.toolExecutor
    );
    this.webSocketModule = new WebSocketModule(
      Number(process.env.WEB_SOCKET_PORT) || 5555
    );
    this.webSocketHandler = new WebSocketHandler(
      this.webSocketModule,
      this.workflowManager,
      this.toolExecutor,
      this.toolRegistry
    );
  }

  // Optional: expose registration methods for tools and data sources
  registerTool(tool: any) {
    this.toolRegistry.registerTool(tool);
  }

  registerDataSource(source: any) {
    this.toolRegistry.registerDataSource(source);
  }

  getToolRegistry() {
    return this.toolRegistry;
  }
}
