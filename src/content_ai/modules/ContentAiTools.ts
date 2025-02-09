import AiTools, { ITool, Tool } from "../../modules/aiTools/AiTools";

export default class ContentAiTools extends AiTools<ITool> {
  constructor() {
    super();
    this.initializeTools();
  }

  /**
   * Returns common rules applied to all AI tools.
   */
  private getCommonRules(): string[] {
    return [
      "AI must always return structured JSON as per the defined format.",
      "AI should strictly follow tool-specific rules and never deviate from the expected output.",
      "Responses must be concise, relevant, and formatted correctly without additional explanations.",
      "Respond only with valid JSON. Do not write an introduction or summary.",
    ];
  }

  /**
   * Returns specific rules for the Content Idea Generator tool.
   */
  private getIdeaGenerationRules(): string[] {
    return [
      "Ideas must be user-focused, SEO-friendly, and categorized under user defined topic.",
      "Generated ideas should always return structured JSON in the following format:",
      `{ideas: [ 
        { "idea": "string", "category": "string", "keywords": ["string", "string", "string"]} 
    ]}`,
      "Exactly 5 ideas must be generated per request.",
    ];
  }

  /**
   * Returns specific rules for the Content Production tool.
   */
  private getContentProductionRules(): string[] {
    return [
      "Generated content must follow user-defined parameters such as word count, tone, style, and language.",
      "Only return structured JSON in the following format:",
      `{
        "title": "string",
        "content": "string",
        "meta": {
          "tone": "formal" | "informal",
          "style": "blog" | "social_media",
          "language": "en" | "tr"
        },
        "keywords": ["string", "string", "string"]
      }`,
      "Support multi-language content generation (initially Turkish and English).",
      "Drafts must be watermarked and protected from unauthorized modifications or sharing.",
      "Content length must be within the specified 'wordCount'.",
    ];
  }

  private initializeTools(): void {
    this.addTool(this.createContentIdeaGeneratorTool());
    this.addTool(this.createContentProductionTool());
  }

  private createContentIdeaGeneratorTool(): ITool {
    return new Tool({
      toolRules: this.listRules([
        ...this.getIdeaGenerationRules(),
        ...this.getCommonRules(),
      ]),
      toolName: "content_idea_generator",
      toolDescription: `Generate user-focused, SEO-friendly content ideas categorized under predefined topics. Users provide a topic and keywords, and you generate ideas. Respond with JSON only.`,
      toolArgs: {
        topic: "",
        keywords: "",
      },
    });
  }

  private createContentProductionTool(): ITool {
    return new Tool({
      toolRules: this.listRules([
        ...this.getContentProductionRules(),
        ...this.getCommonRules(),
      ]),
      toolName: "content_production",
      toolDescription: `Generate structured content based on selected content idea. Users define parameters such as word count, tone, style, and language. Respond with JSON only.`,
      toolArgs: {
        title: "",
        meta: {
          wordCount: 0,
          tone: "formal", // Options: "formal", "informal"
          style: "blog", // Options: "blog", "social_media", etc.
          language: "en", // Options: "en", "tr", etc.
        },
        keywords: [],
      },
    });
  }
}
