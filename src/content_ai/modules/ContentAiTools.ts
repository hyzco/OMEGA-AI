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
      "Drafts must be watermarked and protected from unauthorized modifications or sharing.",
      "Watermark must be placed at the bottom right corner of the content.",
      "Content length at least must be within the specified 'wordCount'.",
      "Follow E-E-A-T guidelines for content quality and expertise.",
    ];
  }

  /**
   * Returns specific rules for the Content Title Improver tool.
   */
  private getImproveContentTitleRules(): string[] {
    return [
      "Improve the title of the content for better SEO while preserving the original content.",
      "Never shorten or remove any part of the original content. The improved content must be the same length or longer.",
      "Make minor adjustments to the content to improve readability, flow, and SEO without altering the core meaning.",
      "Return structured JSON in the following format:",
      `{
        "title": "string", // Improved title
        "content": "string", // Enhanced content (same or longer than original)
        "keywords": ["string", "string", "string"] // Updated keywords if applicable
      }`,
      "Ensure the improved title is concise, engaging, and incorporates relevant keywords.",
    ];
  }



  private initializeTools(): void {
    this.addTool(this.createContentIdeaGeneratorTool());
    this.addTool(this.createContentProductionTool());
    this.addTool(this.improveContentTitles());
    this.addTool(this.generateMetaDescriptionForSEO());
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

  private improveContentTitles(): ITool {
    return new Tool({
      toolRules: this.listRules([
        ...this.getImproveContentTitleRules(),
        ...this.getCommonRules(),
      ]),
      toolName: "content_title_improver",
      toolDescription: `Improve the title and content for better SEO while preserving the original content. The tool will never shorten or remove any part of the content. It will enhance the title, improve readability, and make adjustments to the content for better flow and SEO. Respond with JSON only.`,
      toolArgs: {
        content: "", // Original content to be improved
        keywords: [], // Optional: Keywords to incorporate into the improved title
      },
    });
  }

  private generateMetaDescriptionForSEO(): ITool {
    return new Tool({
      toolRules: this.listRules([
        "Meta descriptions should be concise, relevant, and engaging.",
        "Meta descriptions should be between 150-160 characters.",
        "Meta descriptions should include target keywords.",
        "Return structured JSON in the following format:",
        `{
          "metaDesc": "string", // Generated meta description
          "keywords": ["string", "string", "string"] // Updated keywords if applicable
        }`,
      ]),
      toolName: "meta_description_generator",
      toolDescription: `Generate a meta description for SEO purposes based on the provided title, keywords and content. The meta description should be concise, engaging, and relevant to the content. Respond with JSON only.`,
      toolArgs: {
        title: "",
        content: "",
        keywords: [],
        metaDesc: "",
      },
    });
  }
}
