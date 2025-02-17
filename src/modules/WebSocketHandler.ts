import WebSocketModule, { WebSocketMessage } from "./WebSocketModule";
import { WebSocket } from "ws";
import { WorkflowManager } from "./WorkFlowManager";
import { ToolExecutor } from "./aiTools/ToolExecutor";
import { ToolRegistry } from "./aiTools/ToolRegistry";
import logger from "../utils/Logger";
import { IterableReadableStream } from "@langchain/core/utils/stream";

export class WebSocketHandler {
  constructor(
    private readonly webSocketModule: WebSocketModule,
    private readonly workflowManager: WorkflowManager,
    private readonly toolExecutor: ToolExecutor,
    private readonly toolRegistry: ToolRegistry
  ) {
    // Pass our custom message handler (which receives both the message and the originating ws)
    this.webSocketModule.initializeWebSocket(
      this.handleWebSocketMessage.bind(this)
    );
  }

  /**
   * Handles incoming WebSocket messages.
   * Uses the client’s assigned clientId (attached to ws) as the sessionId.
   */
  async handleWebSocketMessage(message: WebSocketMessage, ws: WebSocket) {
    const sessionId = (ws as any).clientId || this.generateSessionId();
    try {
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
    } catch (error: any) {
      logger.error("WebSocket handling error:", error);
      this.sendError(sessionId, error.message);
    }
  }

  private async handleToolExecution(
    message: WebSocketMessage,
    sessionId: string
  ) {
    const { toolName, input, stream } = message.data;
    try {
      if (stream) {
        const result = await this.toolExecutor.executeTool(toolName, input);
        this.sendSuccessStream(sessionId, result);
      } else {
        const result = await this.toolExecutor.executeToolWithJsonOutput(toolName, input);
        this.sendSuccess(sessionId, result);
      }
    } catch (error: any) {
      this.sendError(sessionId, error.message);
    }
  }

  private async handleWorkflowExecution(
    message: WebSocketMessage,
    sessionId: string
  ) {
    const { workflowId, input } = message.data;
    try {
      const result = await this.workflowManager.executeWorkflow(
        workflowId,
        input
      );
      this.sendSuccess(sessionId, result);
    } catch (error: any) {
      this.sendError(sessionId, error.message);
    }
  }

  private async handleWorkflowCreation(
    message: WebSocketMessage,
    sessionId: string
  ) {
    try {
      const workflowId = this.workflowManager.createWorkflow(message.data);
      this.sendSuccess(sessionId, { workflowId });
    } catch (error: any) {
      this.sendError(sessionId, error.message);
    }
  }

  /**
   * Sends a success response to the client.
   */
  private sendSuccess(sessionId: string, data: any) {
    this.webSocketModule.sendMessageToClient(sessionId, {
      status: "success",
      data,
    });
  }

  /**
   * Sends a stream (as multiple messages) to the client.
   */
  private async sendSuccessStream(
    sessionId: string,
    stream: IterableReadableStream<string>
  ) {
    await this.webSocketModule.sendIterableReadableStream(sessionId, stream);
  }

  /**
   * Sends an error response to the client.
   */
  private sendError(sessionId: string, message: string) {
    this.webSocketModule.sendMessageToClient(sessionId, {
      status: "error",
      message,
    });
  }

  /**
   * Generates a session ID (fallback in case none is attached to the WebSocket).
   */
  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
