import { SystemMessage } from "@langchain/core/messages";
import { ITool } from "../../modules/aiTools/AiTools";
import logger from "../../utils/Logger";
import DynamicRAGBuilder from "../../DynamicRagBuilder";

export default class ContentAiToolHandlers {
  protected ragInstance: DynamicRAGBuilder;

  constructor(ragInstance: DynamicRAGBuilder) {
    if (!ragInstance) {
      throw new Error(
        "Invalid ContentAI instance provided to ContentAiToolHandlers."
      );
    }
    this.ragInstance = ragInstance;
  }

  /**
   * Handles Content Idea Generation Tool
   * @param userInput - User-provided input for generating content ideas.
   * @param toolJson - Tool configuration and arguments.
   */
  public async handleContentIdeaGeneratorTool(toolJson: ITool) {
    try {
      console.log("toolJson", toolJson);
      const topic = toolJson.toolArgs.topic;
      const keywords = toolJson.toolArgs.keywords;

      if (!topic || !keywords) {
        throw new Error(
          "Topic and keywords must be provided for content idea generation."
        );
      }

      logger.info(`Generating content ideas for topic: ${topic}`);
      const generatedPrompt = this.ragInstance.generatePrompt([
        new SystemMessage(JSON.stringify(toolJson), { topic, keywords }),
      ]);
      console.log("generatedPrompt", generatedPrompt);
      const response = await this.ragInstance.invokePrompt(generatedPrompt);
      logger.info("Generated content ideas successfully.");
      return response;
    } catch (error) {
      logger.error(`Error in handleContentIdeaGeneratorTool: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handles Content Production Tool
   * @param userInput - User-provided input for producing detailed content.
   * @param toolJson - Tool configuration and arguments.
   */
  public async handleContentProductionTool(toolJson: ITool) {
    try {
      console.log("toolJson", toolJson);
      const { title, keywords, meta } = toolJson.toolArgs;
      if (
        !title ||
        !keywords ||
        !meta?.wordCount ||
        !meta?.tone ||
        !meta?.style ||
        !meta?.language
      ) {
        throw new Error(
          "Title, word count, tone, style, and language must be provided for content production."
        );
      }

      console.log("handling content production tool");

      const generatedPrompt = this.ragInstance.generatePrompt([
        new SystemMessage(JSON.stringify(toolJson), toolJson.toolArgs),
      ]);
      const response = await this.ragInstance.invokePrompt(generatedPrompt);
      console.log("response", response);

      logger.info("Content produced successfully.");
      return response;
    } catch (error) {
      logger.error(`Error in handleContentProductionTool: ${error.message}`);
      throw error;
    }
  }
}
