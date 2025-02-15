import { ChatOllama } from "@langchain/ollama";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessageChunk,
} from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import AiTools, { ITool } from "./modules/aiTools/AiTools";
import CassandraVectorDatabase from "./database/CassandraVectorDatabase";
import NoteManagementPlugin from "./plugins/NoteManagement.plugin";
import { CassandraClient } from "./database/CassandraClient";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import logger from "./utils/Logger";
import inquirer, { PromptModule } from "inquirer";

export default class RAG {
  protected inquirer: PromptModule;

  protected aiTools: AiTools<ITool>;
  protected noteManagementPlugin: NoteManagementPlugin;
  protected chatModel: ChatOllama;
  protected conversationHistory: (HumanMessage | AIMessage | SystemMessage)[];
  protected dialogRounds: number;
  protected vectorDatabase: CassandraVectorDatabase;

  constructor() {
    console.time("RAG constructor");
    try {
      CassandraClient.keySpace = process.env["ASTRA_DB_KEY_SPACE"];
      CassandraClient.secureConnectBundle =
        process.env["ASTRA_DB_SECURE_BUNDLE_PATH"];

      this.inquirer = inquirer.createPromptModule();
      this.vectorDatabase = CassandraVectorDatabase.getInstance();
      this.chatModel = null;
      this.dialogRounds = 10;
      this.conversationHistory = [];
      this.noteManagementPlugin = new NoteManagementPlugin(this.vectorDatabase);
    } catch (error) {
      logger.error("RAG Class:", error);
    }
    console.timeEnd("RAG constructor");
  }

  async build(): Promise<ChatOllama> {
    console.time("Chat model build");
    try {
      this.chatModel = new ChatOllama({
        baseUrl: process.env.OLLAMA_HOST,
        model: process.env.DEFAULT_MODEL,
      });
      logger.info("Chat model is built.");
    } catch (error) {
      logger.error("Chat model could not be built: ", error);
    }
    console.timeEnd("Chat model build");
    return this.chatModel;
  }

  // Get user input method
  async getUserInput(): Promise<string> {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "userInput",
        message: "Enter your input:",
      },
    ]);
    return answers.userInput;
  }

  generatePrompt(
    messages: (SystemMessage | HumanMessage | AIMessage)[]
  ): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages(messages);
  }

  async invokePrompt(
    prompt: ChatPromptTemplate
  ): Promise<IterableReadableStream<string>> {
    try {
      let result = await prompt
        .pipe(this.chatModel)
        .pipe(new StringOutputParser())
        .stream({});

      return result;
    } catch (error) {
      logger.error("Prompt invocation failed: ", error);
      throw error;
    }
  }

  protected setAiTools = (aiTools: AiTools<ITool>) => {
    this.aiTools = aiTools;
  };

  protected setSystemMessage(message: string) {
    if (this.conversationHistory.length < 1) {
      this.conversationHistory.push(new SystemMessage(message));
    }
  }

  protected removeThinkTag(response: string): string {
    return response.replace(/<think>.*?<\/think>/gs, ""); // Remove think blocks in string responses
  }
}
