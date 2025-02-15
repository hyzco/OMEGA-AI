import { IterableReadableStream } from "@langchain/core/utils/stream";
import DynamicRAGBuilder from "../DynamicRagBuilder";
import ContentAiToolHandlers from "./modules/ContentAiToolHandlers";
import ContentAiTools from "./modules/ContentAiTools";

export class ContentAI extends DynamicRAGBuilder {
  private readonly contentAiToolHandlers: ContentAiToolHandlers;

  constructor() {
    super();
    this.contentAiToolHandlers = new ContentAiToolHandlers(this);
    this.initializeContentTools();
    this.createDefaultWorkflows();
  }

  private initializeContentTools() {
    const tools = new ContentAiTools();
    const ideaTool = tools.getTool("content_idea_generator");
    const contentTool = tools.getTool("content_production");
    this.setAiTools(tools);

    // Register content-specific tools
    this.toolRegistry.registerTool({
      interface: ideaTool,
      inputSchema: {
        type: "object",
        properties: {
          topic: { type: "string" },
          keywords: { type: "string" },
        },
        required: ["topic", "keywords"],
      },
      outputSchema: {
        type: "object",
        properties: {
          ideas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
              },
            },
          },
        },
      },
      handler: this.contentAiToolHandlers.handleContentIdeaGeneratorTool.bind(
        this.contentAiToolHandlers
      ),
    });

    this.toolRegistry.registerTool({
      interface: contentTool,
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          keywords: { type: "array" },
          meta: {
            type: "object",
            properties: {
              wordCount: { type: "number", minimum: 100 },
              tone: { type: "string" },
              style: { type: "string" },
              language: { type: "string" },
            },
            required: ["wordCount", "tone", "style", "language"],
          },
        },
        required: ["title", "keywords", "meta"],
      },
      outputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          meta: {
            type: "object",
            properties: {
              wordCount: { type: "number" },
              tone: { type: "string" },
              style: { type: "string" },
              language: { type: "string" },
              keywords: { type: "array" },
            },
          },
        },
      },
      handler: this.contentAiToolHandlers.handleContentProductionTool.bind(
        this.contentAiToolHandlers
      ),
    });
  }

  private createDefaultWorkflows() {
    // Create default content generation workflow
    this.toolRegistry.createWorkflow({
      name: "default_content_generation",
      description: "Standard content generation workflow",
      steps: [
        {
          toolName: "content_idea_generator",
          inputMapping: {
            topic: "input.topic",
            keywords: "input.keywords",
          },
        },
        {
          toolName: "content_production",
          inputMapping: {
            title: "output.ideas[0].idea", //$index to process multiple ideas
            keywords: "output.ideas[0].keywords", //$index to process multiple ideas
            meta: "input.meta",
          },
        },
      ],
    });
  }

  // Preserve existing methods for backward compatibility
  public async produceContentIdeas(
    userInput: string | any
  ): Promise<IterableReadableStream<string>> {
    return this.toolExecutor.executeTool("content_idea_generator", {
      topic: userInput.topic,
      keywords: userInput.keywords,
    });
  }

  public async produceContent(
    userInput: any
  ): Promise<IterableReadableStream<string>> {
    return this.toolExecutor.executeTool("content_production", {
      title: userInput.title,
      keywords: userInput.keywords,
      meta: {
        wordCount: userInput.meta.wordCount,
        tone: userInput.meta.tone,
        style: userInput.meta.style,
        language: userInput.meta.language,
      },
    });
  }

  // Add helper method to find workflow by name
  public getWorkflowByName(name: string) {
    return this.toolRegistry.getWorkflowByName(name);
  }
}
