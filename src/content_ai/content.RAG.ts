import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import { ChatOllama } from "@langchain/ollama";
import CassandraVectorDatabase from "../database/CassandraVectorDatabase";
import AiTools, { ITool } from "../modules/aiTools/AiTools";
import NoteManagementPlugin from "../plugins/NoteManagement.plugin";
import RAG from "../RAG";
import AiToolsModule from "../modules/aiTools/AiToolsModule";
import ToolRegistry, { Registry } from "../modules/aiTools/ToolRegistry";
import ContentAiTools from "./modules/ContentAiTools";
import ContentAiToolHandlers from "./modules/ContentAiToolHandlers";
import logger from "../utils/Logger";
import WebSocketModule, { WebSocketMessage } from "../modules/WebSocketModule";

export default class ContentAI extends RAG {
  protected webSocketModule: WebSocketModule;

  protected aiToolsModule: AiToolsModule;
  private readonly toolRegistry = new ToolRegistry();
  private readonly contentAiToolHandlers: ContentAiToolHandlers;

  constructor() {
    super();
    this.webSocketModule = new WebSocketModule(5555);
    this.webSocketModule.initializeWebSocket(
      this.handleWebSocketMessage.bind(this)
    );

    const tools = new ContentAiTools();
    this.contentAiToolHandlers = new ContentAiToolHandlers(this);
    this.setAiTools(tools);

    // Registering tools and handlers
    const toolRegistries = [
      {
        tool: tools.getTool("content_idea_generator"),
        handler: this.contentAiToolHandlers.handleContentIdeaGeneratorTool.bind(
          this.contentAiToolHandlers
        ),
      } as Registry,
      {
        tool: tools.getTool("content_production"),
        handler: this.contentAiToolHandlers.handleContentProductionTool.bind(
          this.contentAiToolHandlers
        ),
      } as Registry,
    ];

    toolRegistries.forEach((registry: Registry) => {
      this.toolRegistry.registerTool(registry);
    });
  }

  /**
   * Handles incoming messages from the WebSocket server
   */

  public async handleWebSocketMessage(
    message: WebSocketMessage,
    ws: WebSocket
  ) {
    try {
      if (message.type === "PRODUCE_IDEA") {
        const response = await this.produceContentIdeas(message.data);
        this.webSocketModule.sendIterableReadableStream(response);
      } else if (message.type === "PRODUCE_CONTENT") {
        const response = await this.produceContent(message.data);
        this.webSocketModule.sendIterableReadableStream(response);
      }
    } catch (error) {
      logger.error("Error in handleWebSocketMessage:", error);
    }
  }

  /**
   * Creates content ideas using the "content_idea_generator" tool
   */
  protected async produceContentIdeas(
    userInput: string | any
  ): Promise<IterableReadableStream<string>> {
    try {
      // Retrieve user input
      if (!userInput) {
        throw new Error("No user input provided.");
      }
      console.log("userInput", userInput);

      if (!userInput.topic || !userInput.keywords) {
        throw new Error("Topic and keywords must be provided.");
      }

      if (
        typeof userInput.topic !== "string" ||
        typeof userInput.keywords !== "string"
      ) {
        throw new Error("Invalid arguments provided.");
      }

      if (userInput.topic.length < 1 || userInput.keywords.length < 1) {
        throw new Error("Invalid arguments provided.");
      }

      // Retrieve tool and execute it
      const { tool, handler } = this.toolRegistry.getTool(
        "content_idea_generator"
      );
      if (!tool) {
        throw new Error(
          "Tool 'content_idea_generator' not found in the registry."
        );
      }

      const toolArgs = {
        topic: userInput.topic,
        keywords: userInput.keywords,
      };

      tool.toolArgs = toolArgs;

      const response = await handler(tool);

      if (response) {
        return response;
      } else {
        logger.warn("No response received from the 'content_generator' tool.");
      }
    } catch (error) {
      logger.error("Error in createContentIdeas:", error);
    }
  }

  /**
   * Generates detailed content using the "content_production" tool
   */
  protected async produceContent(
    userInput: any
  ): Promise<IterableReadableStream<string>> {
    try {
      // Ensure userInput exists.
      if (!userInput) {
        throw new Error("No user input provided.");
      }

      console.log("userInput", userInput);

      // Validate required fields: topic and keywords.
      if (!userInput.title || !userInput.keywords) {
        throw new Error("Title and keywords must be provided.");
      }
      if (
        typeof userInput.title !== "string" ||
        typeof userInput.keywords !== "string"
      ) {
        throw new Error(
          "Invalid arguments provided. Title and keywords must be strings."
        );
      }
      if (
        userInput.title.trim().length < 1 ||
        userInput.keywords.trim().length < 1
      ) {
        throw new Error(
          "Invalid arguments provided. Topic and keywords cannot be empty."
        );
      }

      if (!userInput.meta) {
        throw new Error("Meta properties must be provided.");
      }

      // Extract meta properties from userInput.
      const { wordCount, tone, style, language } = userInput.meta;

      // Validate meta properties.
      if (typeof wordCount !== "number" || wordCount < 0) {
        throw new Error(
          "Invalid wordCount provided. It must be a non-negative number."
        );
      }
      if (typeof tone !== "string" || tone.trim().length < 1) {
        throw new Error("Invalid tone provided.");
      }
      if (typeof style !== "string" || style.trim().length < 1) {
        throw new Error("Invalid style provided.");
      }
      if (typeof language !== "string" || language.trim().length < 1) {
        throw new Error("Invalid language provided.");
      }

      // Retrieve the 'content_production' tool from the registry.

      const { tool, handler } = this.toolRegistry.getTool("content_production");
      if (!tool) {
        throw new Error(
          "Tool 'content_idea_generator' not found in the registry."
        );
      }

      // Set up the tool arguments using userInput values.
      const toolArgs = {
        title: userInput.title, // Using topic as the title.
        meta: {
          wordCount, // coming from userInput.
          tone, // coming from userInput.
          style, // coming from userInput.
          language, // coming from userInput.
        },
        keywords: userInput.keywords,
      };

      // Assign tool arguments.
      tool.toolArgs = toolArgs;

      // Execute the tool's handler with the tool (including its arguments) and userInput.
      const response = await handler(tool);
      
      if (response) {
        return response;
      } else {
        logger.warn("No response received from the 'content_production' tool.");
      }
    } catch (error) {
      logger.error("Error in produceContent:", error);
      throw error; // Rethrow error for further handling if necessary.
    }
  }
}
