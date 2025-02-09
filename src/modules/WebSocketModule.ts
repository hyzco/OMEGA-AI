import WebSocket, { WebSocketServer } from "ws";
import logger from "../utils/Logger";
import { IterableReadableStream } from "@langchain/core/utils/stream";

interface TranscribedData {
  chunks: any[]; // Adjust as per your actual data structure
}

export interface WebSocketMessage {
  type: string;
  data: any;
}

interface Client {
  id: string;
  ws: WebSocket;
}

export default class WebSocketModule {
  private socket: WebSocketServer | null = null;
  // Optionally keep track of clients with IDs if needed
  private clients: Client[] = [];
  private transcribedChunk: any;

  constructor(private port: number) {
    // No need to reassign this.port here since it's declared in the constructor parameter.
  }

  /**
   * Initializes the WebSocket server.
   * @param customCallback Optional callback to handle incoming messages.
   */
  public initializeWebSocket(
    customCallback?: (message: WebSocketMessage) => void
  ) {
    if (this.socket) {
      logger.warn("WebSocket server is already initialized.");
      return;
    }

    try {
      this.socket = new WebSocketServer({ port: this.port });
    } catch (error) {
      logger.error("Error creating WebSocket server:", error);
      return;
    }

    // Listen for server errors (for example, if the port is already in use)
    this.socket.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        logger.error(`Port ${this.port} is already in use.`);
      } else {
        logger.error("WebSocket Server Error:", error);
      }
    });

    // Log when the server starts listening
    this.socket.on("listening", () => {
      logger.log(`WebSocket Server is listening on port ${this.port}`);
    });

    // Handle new client connections
    this.socket.on("connection", (ws: WebSocket) => {
      logger.log("WebSocket client connected.");

      // Generate a simple client ID (consider using a robust method like UUID for production)
      const clientId = Math.random().toString(36).substring(7);
      this.clients.push({ id: clientId, ws });

      // Handle incoming messages
      ws.on("message", (message: WebSocket.Data) => {
        console.log("Received message:", message.toString());
        try {
          const parsedMessage = JSON.parse(
            message.toString()
          ) as WebSocketMessage;
          this.handleWebSocketMessage(parsedMessage, ws, customCallback);
        } catch (error) {
          logger.error("Error parsing incoming WebSocket message:", error);
        }
      });

      ws.on("error", (err) => {
        logger.error("WebSocket client error:", err);
      });

      ws.on("close", () => {
        logger.log("Client disconnected.");
        // Remove the client from the tracked clients list
        this.clients = this.clients.filter((client) => client.ws !== ws);
      });
    });
  }

  /**
   * Sends an IterableReadableStream to all connected clients.
   * @param stream The stream to send.
   */
  public async sendIterableReadableStream(
    stream: IterableReadableStream<string>
  ) {
    if (!stream) return;

    try {
      for await (const chunk of stream) {
        this.sendMessageToClients({ type: "STREAM_CHUNK", data: chunk });
      }
      // Optionally, you can signal the end of the stream:
      // this.sendMessageToClients({ type: "STREAM_END", data: "Stream ended" });
    } catch (error) {
      logger.error("Error sending stream data:", error);
    }
  }

  /**
   * Sends a message to all connected clients.
   * @param message The message object to send.
   */
  public sendMessageToClients(message: any) {
    if (this.socket) {
      for (const client of this.socket.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      }
    }
  }

  /**
   * Gracefully closes the WebSocket server and all client connections.
   */
  public closeWebSocket() {
    if (this.socket) {
      // Optionally close each client connection
      for (const client of this.socket.clients) {
        client.close();
      }
      this.socket.close(() => {
        logger.log("WebSocket server closed.");
      });
      this.socket = null;
    }
  }

  /**
   * Handles incoming messages from clients.
   * @param message The incoming WebSocket message.
   * @param ws The WebSocket connection from which the message came.
   * @param customCallback Optional custom callback to handle messages.
   */
  private handleWebSocketMessage(
    message: WebSocketMessage,
    ws: WebSocket,
    customCallback?: (msg: WebSocketMessage) => void
  ) {
    console.log("Handling WebSocket message:", message);
    if (customCallback) {
      console.log("Using custom callback to handle message.");
      customCallback(message);
    } else {
      switch (message.type) {
        case "TRANSCRIBED_DATA":
          this.handleTranscribedData(message.data);
          break;
        case "TRANSCRIBED_CHUNK":
          this.handleTranscribedChunk(message.data);
          break;
        default:
          logger.warn("Unknown message type received:", message.type);
      }
    }
  }

  /**
   * Processes full transcribed data.
   * @param data The transcribed data.
   */
  private handleTranscribedData(data: string) {
    logger.log("Received transcribed data:", data);
    this.transcribedChunk = data;
    // Process the full transcribed data as needed
  }

  /**
   * Processes a transcribed chunk.
   * @param chunk The chunk of transcribed data.
   */
  private async handleTranscribedChunk(chunk: any) {
    try {
      logger.log("Received transcribed chunk:", chunk);
      if (chunk.text) {
        this.transcribedChunk = chunk.text.trim();
      } else {
        logger.warn("Chunk does not contain 'text' property:", chunk);
      }
      // Optionally process the chunk further here
    } catch (error) {
      logger.error("Error handling transcribed chunk:", error);
    }
  }
}
