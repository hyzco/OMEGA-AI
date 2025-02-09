// app.ts or index.ts (main entry point)
import initializeApplication from "./config/Initializers";
import { ContentAI } from "./content_ai/content.RAG";
import logger from "./utils/Logger";

class App extends ContentAI {
  constructor() {
    super();
  }

  async start() {
    logger.log("App is initializing.");
    // Initialize application first to load environment variables
    await Promise.resolve(initializeApplication());

    await super.build();
    let i = 0;
    while (i < 10) {
      const input = await super.getUserInput();
      // const workflow = this.getWorkflowByName("default_content_generation");



      // await this.executeWorkflow(workflow.id, {
      //   topic: "AI in finance",
      //   keywords: "blockchain, trading, risk analysis",
      //   meta: {
      //     wordCount: 300,
      //     tone: "professional",
      //     style: "analytical",
      //     language: "en",
      //   },
      // });

      // console.log(await this.convertResponseToString(workflowResult));
      // this.webSocketModule.sendIterableReadableStream(ideas);
      i++;
    }
    logger.warn("APP is terminated.");

    process.exit(0);
  }
}

new App().start();
