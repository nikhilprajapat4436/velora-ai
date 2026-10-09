import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import authMiddleware from "./middleware/authMiddleware.js";
import chatRoutes from "./routes/chatRoutes.js";
import memoryRoutes from "./routes/memoryRoutes.js";
import detectAndSaveMemory from "./services/memoryService.js";
import Memory from "./models/Memory.js";

import documentRoutes from "./routes/documentRoutes.js";
import searchDocuments from "./services/vectorSearchService.js";

import webSearchRoutes from "./routes/webSearchRoutes.js";
import imageGenerationRoutes from "./routes/imageGenerationRoutes.js";
import shouldSearchWeb from "./services/webSearchDecisionService.js";
import searchWeb from "./services/webSearchService.js";

import calculate from "./services/calculatorService.js";
import getCurrentDateTime from "./services/dateTimeService.js";
import convertUnit from "./services/unitConverterService.js";
import convertCurrency from "./services/currencyConverterService.js";
import getWeather from "./services/weatherService.js";
import developerTool from "./services/developerToolService.js";
import searchDocumentTool from "./services/documentSearchToolService.js";
import searchMemory from "./services/memorySearchToolService.js";

dotenv.config();

if (process.env.NODE_ENV === "production") {
  const productionRequirements = [
    ["MONGODB_URI", Boolean(process.env.MONGODB_URI)],
    ["GROQ_API_KEY", Boolean(process.env.GROQ_API_KEY)],
    ["CLOUDFLARE_ACCOUNT_ID", Boolean(process.env.CLOUDFLARE_ACCOUNT_ID)],
    ["CLOUDFLARE_API_TOKEN", Boolean(process.env.CLOUDFLARE_API_TOKEN)],
    [
      "JWT_SECRET (at least 32 characters)",
      Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32),
    ],
  ];
  const missingRequirements = productionRequirements
    .filter(([, configured]) => !configured)
    .map(([name]) => name);

  if (missingRequirements.length) {
    console.error(
      `Production startup blocked. Configure: ${missingRequirements.join(", ")}`,
    );
    process.exit(1);
  }
}

const app = express();
const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendBuildDirectory = path.resolve(serverDirectory, "../dist");

const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
const allowedOrigins = new Set(
  configuredOrigins.length
    ? configuredOrigins
    : process.env.NODE_ENV === "production"
      ? []
      : [
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:4173",
          "http://127.0.0.1:4173",
        ],
);

const encodeHeaderData = (data) => {
  return Buffer.from(JSON.stringify(data), "utf8").toString("base64");
};

// --------------------------------
// NDJSON Event Helper
// --------------------------------

const sendEvent = (res, event) => {
  if (res.writableEnded) return;

  res.write(`${JSON.stringify(event)}\n`);
};

// --------------------------------
// Tool Activity Labels
// --------------------------------

const toolActivityLabels = {
  calculate: {
    start: "Calculating...",
    end: "Calculation completed",
  },

  get_current_date_time: {
    start: "Checking date & time...",
    end: "Date & time ready",
  },

  convert_unit: {
    start: "Converting units...",
    end: "Unit conversion completed",
  },

  search_web: {
    start: "Searching the web...",
    end: "Search completed",
  },

  convert_currency: {
    start: "Converting currency...",
    end: "Currency conversion completed",
  },

  get_weather: {
    start: "Checking weather...",
    end: "Weather checked",
  },

  developer_tool: {
    start: "Processing developer task...",
    end: "Developer task completed",
  },

  search_documents: {
    start: "Searching documents...",
    end: "Document search completed",
  },

  search_memory: {
    start: "Checking memory...",
    end: "Memory search completed",
  },

  image_analysis: {
    start: "Analyzing image...",
    end: "Image analysis completed",
  },
};

const getToolLabel = (toolName, type = "start") => {
  return (
    toolActivityLabels[toolName]?.[type] ||
    (type === "start" ? "Working..." : "Task completed")
  );
};

const getWebSearchOptions = (query, maxResults = 5) => {
  const text = query.toLowerCase();
  const isNewsQuery = /\bnews\b|\bheadlines?\b|समाचार|ख़बर|खबरें|खबरों/.test(
    text,
  );
  const isFreshQuery =
    /\btoday\b|\btonight\b|\bcurrent(?:ly)?\b|\blatest\b|\brecent\b|\bnow\b|\baaj\b|आज|ताज़ा|ताजा/.test(
      text,
    );

  return {
    maxResults,
    categories: isNewsQuery ? "news" : "general",
    ...(isFreshQuery ? { timeRange: "day" } : {}),
  };
};

connectDB();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin.replace(/\/$/, ""))) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["X-Document-Sources", "X-Web-Sources"],
  }),
);

app.use(
  express.json({
    limit: "16mb",
  }),
);

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

app.get("/api/health", (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  const status = databaseConnected ? "online" : "offline";

  res.status(databaseConnected ? 200 : 503).json({
    status,
    services: {
      api: "online",
      database: databaseConnected ? "connected" : "disconnected",
    },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/memories", memoryRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/web-search", webSearchRoutes);
app.use("/api/images", imageGenerationRoutes);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

app.get("/api/status", (_req, res) => {
  res.json({
    message: "Velora AI backend is running",
  });
});

// --------------------------------
// Calculator Tool
// --------------------------------

const calculatorTool = {
  type: "function",
  function: {
    name: "calculate",
    description:
      "Perform accurate mathematical calculations. Use this tool whenever the user asks for arithmetic, percentages, or mathematical expressions.",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description:
            "A mathematical expression such as 125 * 48, 500 / 25, or 15% of 800.",
        },
      },
      required: ["expression"],
      additionalProperties: false,
    },
  },
};

// --------------------------------
// Date & Time Tool
// --------------------------------

const dateTimeTool = {
  type: "function",
  function: {
    name: "get_current_date_time",
    description:
      "Get the current date and time for a specific IANA timezone. Use this whenever the user asks for the current time, current date, or date and time in a location.",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description:
            "IANA timezone such as Asia/Kolkata, Asia/Tokyo, America/New_York, or Europe/London.",
        },
      },
      required: ["timezone"],
      additionalProperties: false,
    },
  },
};

// --------------------------------
// Unit Converter Tool
// --------------------------------

const unitConverterTool = {
  type: "function",
  function: {
    name: "convert_unit",
    description:
      "Convert values between supported units of length, weight, volume, and area. Use this tool whenever the user asks to convert one measurement unit into another.",
    parameters: {
      type: "object",
      properties: {
        value: {
          type: "number",
          description: "The numeric value to convert.",
        },
        from: {
          type: "string",
          description:
            "The source unit, such as kilometer, meter, kg, gram, liter, mile, foot, inch, or acre.",
        },
        to: {
          type: "string",
          description:
            "The target unit, such as meter, kilometer, kg, gram, liter, mile, foot, inch, or acre.",
        },
      },
      required: ["value", "from", "to"],
      additionalProperties: false,
    },
  },
};

// --------------------------------
// Web Search Tool
// --------------------------------

const webSearchTool = {
  type: "function",
  function: {
    name: "search_web",
    description:
      "Search the internet for current, recent, or factual information. Use this when additional web research is needed for latest news, current events, recent updates, releases, announcements, prices, scores, schedules, or information that may have changed.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The exact search query to send to the web search engine.",
        },
        maxResults: {
          type: "number",
          description:
            "Maximum number of search results to return. Usually use 3 to 5.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

// --------------------------------
// Currency Converter Tool
// --------------------------------

const currencyConverterTool = {
  type: "function",
  function: {
    name: "convert_currency",
    description:
      "Convert money from one currency to another using a current exchange rate. Use this whenever the user asks for currency conversion.",
    parameters: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "The amount of money to convert.",
        },
        from: {
          type: "string",
          description:
            "Three-letter ISO currency code such as USD, INR, EUR, GBP, or JPY.",
        },
        to: {
          type: "string",
          description:
            "Three-letter ISO currency code such as USD, INR, EUR, GBP, or JPY.",
        },
      },
      required: ["amount", "from", "to"],
      additionalProperties: false,
    },
  },
};

// --------------------------------
// Weather Tool
// --------------------------------

const weatherTool = {
  type: "function",
  function: {
    name: "get_weather",
    description:
      "Get current weather and forecast for a location. Use this whenever the user asks about weather, temperature, rain, humidity, wind, or forecast.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City, town, or location name.",
        },
        forecastDays: {
          type: "number",
          description:
            "Number of forecast days from 1 to 7. Use 1 when the user asks only for current weather.",
        },
      },
      required: ["location"],
      additionalProperties: false,
    },
  },
};

// --------------------------------
// Developer / Code Tool
// --------------------------------

const developerToolDefinition = {
  type: "function",
  function: {
    name: "developer_tool",
    description:
      "Perform safe developer utilities without executing arbitrary user code. Use this for JavaScript syntax validation, JSON formatting/validation, and Base64 encoding or decoding.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "validate_javascript",
            "format_json",
            "encode_base64",
            "decode_base64",
          ],
          description: "The developer operation to perform.",
        },
        code: {
          type: "string",
          description: "JavaScript code when using validate_javascript.",
        },
        text: {
          type: "string",
          description:
            "Text or JSON string when using format_json, encode_base64, or decode_base64.",
        },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
};

// --------------------------------
// Document Search Tool
// --------------------------------

const documentSearchTool = {
  type: "function",
  function: {
    name: "search_documents",
    description:
      "Search the user's uploaded documents for relevant information.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The question or search query.",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

// --------------------------------
// Memory Search Tool
// --------------------------------

const memoryTool = {
  type: "function",
  function: {
    name: "search_memory",
    description:
      "Retrieve information previously stored in the user's long-term memory.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional topic or phrase to search for.",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of memories.",
        },
      },
      additionalProperties: false,
    },
  },
};

// --------------------------------
// Tool Definitions
// --------------------------------

const toolDefinitions = [
  calculatorTool,
  dateTimeTool,
  unitConverterTool,
  webSearchTool,
  currencyConverterTool,
  weatherTool,
  developerToolDefinition,
  documentSearchTool,
  memoryTool,
];

// --------------------------------
// Available Tools
// --------------------------------

const createAvailableTools = (userId, fallbackDocumentQuery = "") => {
  return {
    calculate,

    get_current_date_time: getCurrentDateTime,

    convert_unit: convertUnit,

    search_web: async ({ query, maxResults = 5 }) => {
      if (!query || typeof query !== "string") {
        throw new Error("Search query is required");
      }

      const safeMaxResults = Math.min(Math.max(Number(maxResults) || 5, 1), 5);

      return await searchWeb(query, getWebSearchOptions(query, safeMaxResults));
    },

    convert_currency: async ({ amount, from, to }) => {
      return await convertCurrency({
        amount,
        from,
        to,
      });
    },

    get_weather: async ({ location, forecastDays = 1 }) => {
      return await getWeather({
        location,
        forecastDays,
      });
    },

    developer_tool: async ({ action, code, text }) => {
      return await developerTool({
        action,
        code,
        text,
      });
    },

    search_documents: async ({ query, maxResults = 5 }) => {
      return await searchDocumentTool({
        userId,
        query:
          typeof query === "string" && query.trim()
            ? query.trim()
            : fallbackDocumentQuery,
        maxResults,
      });
    },

    search_memory: async ({ query, maxResults = 10 }) => {
      return await searchMemory({
        userId,
        query,
        maxResults,
      });
    },
  };
};

// --------------------------------
// Execute Tool
// --------------------------------

const executeToolCall = async (toolCall, availableTools) => {
  const functionName = toolCall?.function?.name;

  if (!functionName) {
    throw new Error("Tool name is missing");
  }

  const functionToCall = availableTools[functionName];

  if (!functionToCall) {
    throw new Error(`Unknown tool: ${functionName}`);
  }

  let functionArgs;

  try {
    functionArgs = JSON.parse(toolCall.function.arguments || "{}");
  } catch {
    throw new Error("Invalid tool arguments");
  }

  if (
    !functionArgs ||
    typeof functionArgs !== "object" ||
    Array.isArray(functionArgs)
  ) {
    throw new Error("Tool arguments must be an object");
  }

  if (functionName === "calculate") {
    if (
      !functionArgs.expression ||
      typeof functionArgs.expression !== "string"
    ) {
      throw new Error("Calculator expression is required");
    }

    const result = functionToCall(functionArgs.expression);

    return String(result);
  }

  if (functionName === "get_current_date_time") {
    const result = functionToCall(functionArgs.timezone || "Asia/Kolkata");

    return JSON.stringify(result);
  }

  if (functionName === "convert_unit") {
    const result = functionToCall({
      value: functionArgs.value,
      from: functionArgs.from,
      to: functionArgs.to,
    });

    return JSON.stringify(result);
  }

  if (functionName === "search_web") {
    const result = await functionToCall({
      query: functionArgs.query,
      maxResults: functionArgs.maxResults,
    });

    return JSON.stringify(result);
  }

  if (functionName === "convert_currency") {
    const result = await functionToCall({
      amount: functionArgs.amount,
      from: functionArgs.from,
      to: functionArgs.to,
    });

    return JSON.stringify(result);
  }

  if (functionName === "get_weather") {
    const result = await functionToCall({
      location: functionArgs.location,
      forecastDays: functionArgs.forecastDays,
    });

    return JSON.stringify(result);
  }

  if (functionName === "developer_tool") {
    const result = await functionToCall({
      action: functionArgs.action,
      code: functionArgs.code,
      text: functionArgs.text,
    });

    return JSON.stringify(result);
  }

  if (functionName === "search_documents") {
    const result = await functionToCall({
      query: functionArgs.query,
      maxResults: functionArgs.maxResults,
    });

    return JSON.stringify(result);
  }

  if (functionName === "search_memory") {
    const result = await functionToCall({
      query: functionArgs.query,
      maxResults: functionArgs.maxResults,
    });

    return JSON.stringify(result);
  }

  throw new Error(`Unsupported tool: ${functionName}`);
};

// --------------------------------
// Tool Retry
// --------------------------------

const retryableTools = new Set([
  "search_web",
  "convert_currency",
  "get_weather",
  "search_documents",
]);

const executeToolWithRetry = async (toolCall, availableTools) => {
  const toolName = toolCall?.function?.name;

  const shouldRetry = retryableTools.has(toolName);

  let lastError;

  const maxAttempts = shouldRetry ? 2 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await executeToolCall(toolCall, availableTools);
    } catch (error) {
      lastError = error;

      console.error(`Tool attempt ${attempt} failed:`, error);

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  throw lastError;
};

// --------------------------------
// Document Search API
// --------------------------------

app.post("/api/documents/search", authMiddleware, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const results = await searchDocuments(req.userId, query, 5);

    res.status(200).json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Document Search Error:", error);

    res.status(500).json({
      success: false,
      message: "Document search failed",
    });
  }
});

// --------------------------------
// Main AI Chat
// --------------------------------

app.post("/api/chat", authMiddleware, async (req, res) => {
  try {
    const {
      message,
      history = [],
      image = null,
      document = null,
      preferences = {},
    } = req.body;

    console.log("Chat request received", {
      hasMessage: Boolean(message?.trim()),
      hasImage: Boolean(image),
      hasDocument: Boolean(document?.uploaded),
    });

    if ((!message || !message.trim()) && !image) {
      return res.status(400).json({
        success: false,
        message: "Message or image is required",
      });
    }

    // --------------------------------
    // Image Validation
    // --------------------------------

    if (image) {
      if (typeof image !== "string" || !image.startsWith("data:image/")) {
        return res.status(400).json({
          success: false,
          message: "Invalid image format",
        });
      }

      const imageSizeInMB = Buffer.byteLength(image, "utf8") / (1024 * 1024);

      if (imageSizeInMB > 20) {
        return res.status(400).json({
          success: false,
          message: "Image is too large. Maximum image size is 20 MB.",
        });
      }
    }

    // --------------------------------
    // Prepare Streaming Response
    // --------------------------------

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");

    res.setHeader("Cache-Control", "no-cache, no-transform");

    res.setHeader("Connection", "keep-alive");

    res.setHeader("Transfer-Encoding", "chunked");

    // Source headers remain available
    // for compatibility.
    // Actual sources are also sent
    // through the NDJSON stream.
    res.setHeader("X-Document-Sources", encodeHeaderData([]));

    res.setHeader("X-Web-Sources", encodeHeaderData([]));

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    // --------------------------------
    // Image Activity
    // --------------------------------

    if (image) {
      sendEvent(res, {
        type: "tool_start",
        tool: "image_analysis",
        label: getToolLabel("image_analysis", "start"),
      });
    }

    // --------------------------------
    // Document Search / RAG
    // --------------------------------

    let documentResults = [];

    if (message?.trim() && document?.uploaded && document?.hasQuestion) {
      sendEvent(res, {
        type: "tool_start",
        tool: "search_documents",
        label: getToolLabel("search_documents", "start"),
      });

      try {
        documentResults = await searchDocuments(req.userId, message, 3);

        sendEvent(res, {
          type: "tool_end",
          tool: "search_documents",
          label: getToolLabel("search_documents", "end"),
        });
      } catch (error) {
        sendEvent(res, {
          type: "tool_end",
          tool: "search_documents",
          label: "Document search failed",
          success: false,
        });

        throw error;
      }
    }

    // --------------------------------
    // Web Search
    // --------------------------------

    const useWebSearch = message?.trim() ? shouldSearchWeb(message) : false;

    let webResults = [];

    if (useWebSearch) {
      sendEvent(res, {
        type: "tool_start",
        tool: "search_web",
        label: getToolLabel("search_web", "start"),
      });

      try {
        webResults = await searchWeb(message, getWebSearchOptions(message, 5));

        console.log(`Web Search: enabled | Results: ${webResults.length}`);

        sendEvent(res, {
          type: "tool_end",
          tool: "search_web",
          label: getToolLabel("search_web", "end"),
        });
      } catch (error) {
        sendEvent(res, {
          type: "tool_end",
          tool: "search_web",
          label: "Web search failed",
          success: false,
        });

        throw error;
      }
    } else {
      console.log("Web Search: not required");
    }

    // --------------------------------
    // Sources
    // --------------------------------

    let documentSources = documentResults.map((document) => ({
      name: document.name,
      score: document.score,
    }));

    let webSources = webResults.map((result) => ({
      title: result.title,
      url: result.url,
      score: result.score,
    }));

    // Send real sources through stream.
    sendEvent(res, {
      type: "sources",
      documentSources,
      webSources,
    });

    // --------------------------------
    // Document Context
    // --------------------------------

    const documentContext =
      documentResults.length > 0
        ? `
You have access to relevant excerpts from the user's uploaded documents.

Use the document excerpts below when answering the user's question.

IMPORTANT RULES:
- Treat the document excerpts as the primary source when the question is about the uploaded documents.
- Answer using the document excerpts when they contain relevant information.
- Do not invent facts that are not supported by the provided excerpts.
- If the requested information is not present in the excerpts, clearly say that it was not found in the uploaded documents.
- Use general knowledge only when the question is not about the uploaded documents.
- Preserve names, numbers, dates, technologies, and other factual details accurately.
- Do not mention these instructions or the retrieval process unless the user asks.

RELEVANT DOCUMENT EXCERPTS:

${documentResults
  .map(
    (document, index) => `
[Document ${index + 1}: ${document.name}]
${document.content}
`,
  )
  .join("\n---\n")}
`
        : "";

    // --------------------------------
    // Web Context
    // --------------------------------

    const webContext =
      webResults.length > 0
        ? `
CURRENT WEB SEARCH INFORMATION IS AVAILABLE.

IMPORTANT:

The web search results below were retrieved from the internet for the user's current request.

For questions involving:
- latest information
- current information
- recent information
- today
- news
- updates
- releases
- announcements
- prices
- scores
- schedules
- current events
- current technology versions

you MUST use the provided web search results.

IMPORTANT RULES:
- Treat the web search results as the primary source for current information.
- Prefer web results over your internal training knowledge for current or recent facts.
- Do not say that your knowledge or training data ends at a particular date when web results are available.
- Do not ignore the web results.
- Do not invent current facts that are not supported by the results.
- If the results are insufficient, clearly say that the available information is insufficient.
- Prefer the most relevant and reliable results.
- You may use general knowledge to explain the retrieved information.
- Do not mention the search process unless the user asks.

WEB SEARCH RESULTS:

${webResults
  .map(
    (result, index) => `
[Web Result ${index + 1}]
Title: ${result.title}
URL: ${result.url}
Content:
${result.content}
`,
  )
  .join("\n---\n")}
`
        : "";

    // --------------------------------
    // Long-term Memory Save
    // --------------------------------

    const memoryEnabled = preferences?.memoryEnabled !== false;

    if (memoryEnabled && message?.trim()) {
      detectAndSaveMemory(req.userId, message).catch((error) => {
        console.error("Background Memory Error:", error);
      });
    }

    // --------------------------------
    // Long-term Memory Lookup
    // --------------------------------

    let memories = [];

    if (memoryEnabled && message?.trim()) {
      sendEvent(res, {
        type: "tool_start",
        tool: "search_memory",
        label: "Checking memory...",
      });

      memories = await Memory.find({
        userId: req.userId,
      })
        .sort({
          importance: -1,
          updatedAt: -1,
        })
        .limit(20);

      sendEvent(res, {
        type: "tool_end",
        tool: "search_memory",
        label: "Memory check completed",
      });
    }

    const memoryContext =
      memories.length > 0
        ? `
Relevant information remembered about the user:

${memories.map((memory) => `- ${memory.content}`).join("\n")}

Use this information only when relevant to the user's current request.
Do not mention that you accessed a memory unless the user asks.
`
        : "";

    // --------------------------------
    // Web Priority Instruction
    // --------------------------------

    const webPriorityInstruction =
      webResults.length > 0
        ? {
            role: "system",
            content: `
WEB SEARCH PRIORITY:

Current web search results are available.

For current or recent questions:
- Use the web search results.
- Treat them as the source of current facts.
- Do not rely on outdated internal knowledge when web results provide newer information.
- Do not mention a training cutoff.
- Do not tell the user to search the web themselves when the required results are already provided.
- Answer the user's question directly using the retrieved information.
- If the retrieved information is insufficient, say so clearly.
`,
          }
        : null;

    // --------------------------------
    // Tool Instructions
    // --------------------------------

    const toolInstruction = {
      role: "system",
      content: `
TOOL USAGE:

You have access to multiple tools.

Use tools whenever they provide more accurate, current, user-specific, or computational information.

AVAILABLE CAPABILITIES:
- Calculator: accurate mathematical calculations.
- Date & Time: current date/time for a timezone.
- Unit Converter: measurement conversions.
- Web Search: current internet information.
- Currency Converter: current exchange-rate conversion.
- Weather: current weather and forecast.
- Developer Tool: safe JavaScript syntax validation, JSON formatting, and Base64 utilities.
- Document Search: information from the user's uploaded documents.
- Memory Search: information stored in the user's long-term memory.

IMPORTANT:
- Do not invent tool results.
- If a tool fails, continue using the error information appropriately.
- Do not expose internal tool arguments, tool IDs, or implementation details unless the user asks.
- For calculations and conversions, prefer the corresponding tool instead of doing the calculation yourself.
- For current weather, use the weather tool.
- For currency conversion, use the currency tool.
- For uploaded-document questions, use document search when additional retrieval is useful.
- For explicit memory questions, use memory search when needed.
- Multiple tools may be used in the same response when necessary.
`,
    };

    const preferenceOptions = {
      language: {
        auto: "Reply in the language used by the user in their latest message.",
        english:
          "Reply in English unless the user explicitly asks for another language.",
        hindi:
          "Reply in Hindi unless the user explicitly asks for another language.",
      },
      length: {
        concise: "Keep the answer concise and include only the useful details.",
        balanced: "Use a balanced level of detail appropriate to the question.",
        detailed:
          "Give a thorough answer with useful context and clear steps when appropriate.",
      },
      tone: {
        friendly: "Use a friendly, approachable tone.",
        professional: "Use a professional and clear tone.",
        casual: "Use a relaxed, conversational tone.",
      },
    };
    const safePreferences =
      preferences && typeof preferences === "object" ? preferences : {};
    const responsePreferenceInstruction = {
      role: "system",
      content: `RESPONSE PREFERENCES:\n- ${preferenceOptions.language[safePreferences.language] || preferenceOptions.language.auto}\n- ${preferenceOptions.length[safePreferences.length] || preferenceOptions.length.balanced}\n- ${preferenceOptions.tone[safePreferences.tone] || preferenceOptions.tone.friendly}\nFollow these preferences unless the user requests something different for this response.`,
    };

    // --------------------------------
    // AI Messages
    // --------------------------------

    const contents = [
      toolInstruction,
      responsePreferenceInstruction,

      ...(webPriorityInstruction ? [webPriorityInstruction] : []),

      ...(memoryContext
        ? [
            {
              role: "system",
              content: memoryContext,
            },
          ]
        : []),

      ...(documentContext
        ? [
            {
              role: "system",
              content: documentContext,
            },
          ]
        : []),

      ...(webContext
        ? [
            {
              role: "system",
              content: webContext,
            },
          ]
        : []),

      ...history.map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: item.content,
      })),

      {
        role: "user",
        content: image
          ? [
              {
                type: "text",
                text: message?.trim() || "Please analyze this image.",
              },
              {
                type: "image_url",
                image_url: {
                  url: image,
                },
              },
            ]
          : message,
      },
    ];

    // --------------------------------
    // Select AI Model
    // --------------------------------

    const requestedModel = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"].includes(
      safePreferences.model,
    )
      ? safePreferences.model
      : "openai/gpt-oss-120b";
    const model = image ? "qwen/qwen3.8-27b" : requestedModel;

    console.log(`AI Model: ${model}`);

    // --------------------------------
    // Function Calling
    // --------------------------------

    const messagesForAI = [...contents];

    const availableTools = createAvailableTools(req.userId, message);

    const tools = image
      ? []
      : memoryEnabled
        ? toolDefinitions
        : toolDefinitions.filter(
            (tool) => tool.function.name !== "search_memory",
          );

    if (image) {
      console.log("Image analysis request started");
    }
    let currentResponse = await groq.chat.completions.create({
      model,
      messages: messagesForAI,
      tools,
      tool_choice: image ? "none" : "auto",
      stream: false,
    });

    if (image) {
      console.log("Image analysis response received");
    }
    // Image analysis finished.
    if (image) {
      sendEvent(res, {
        type: "tool_end",
        tool: "image_analysis",
        label: getToolLabel("image_analysis", "end"),
      });
    }

    const maxToolIterations = 8;

    let toolIteration = 0;

    while (
      currentResponse.choices[0]?.message?.tool_calls?.length &&
      toolIteration < maxToolIterations
    ) {
      toolIteration++;

      const assistantMessage = currentResponse.choices[0].message;

      messagesForAI.push(assistantMessage);

      console.log(
        `Tool Calling: ${assistantMessage.tool_calls.length} tool(s)`,
      );

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall?.function?.name || "unknown";

        // --------------------------------
        // REAL TOOL START EVENT
        // --------------------------------

        sendEvent(res, {
          type: "tool_start",
          tool: toolName,
          label: getToolLabel(toolName, "start"),
        });

        try {
          console.log(`Executing tool: ${toolName}`);

          const toolResult = await executeToolWithRetry(
            toolCall,
            availableTools,
          );

          console.log(`Tool completed: ${toolName}`);

          if (toolName === "search_web") {
            try {
              const toolSources = JSON.parse(toolResult);

              if (Array.isArray(toolSources)) {
                const mergedSources = new Map(
                  webSources.map((source) => [source.url, source]),
                );

                for (const source of toolSources) {
                  if (source?.url) {
                    mergedSources.set(source.url, {
                      title: source.title || source.url,
                      url: source.url,
                      score: source.score || 0,
                    });
                  }
                }

                webSources = [...mergedSources.values()].slice(0, 10);

                sendEvent(res, {
                  type: "sources",
                  documentSources,
                  webSources,
                });
              }
            } catch (sourceError) {
              console.warn(
                "Could not publish web search sources:",
                sourceError,
              );
            }
          }

          if (toolName === "search_documents") {
            try {
              const toolSearch = JSON.parse(toolResult);
              const toolDocuments = Array.isArray(toolSearch?.results)
                ? toolSearch.results
                : [];

              if (toolDocuments.length > 0) {
                const mergedSources = new Map(
                  documentSources.map((source) => [source.name, source]),
                );

                for (const source of toolDocuments) {
                  if (source?.name) {
                    mergedSources.set(source.name, {
                      name: source.name,
                      score: source.score || 0,
                    });
                  }
                }

                documentSources = [...mergedSources.values()].slice(0, 10);

                sendEvent(res, {
                  type: "sources",
                  documentSources,
                  webSources,
                });
              }
            } catch (sourceError) {
              console.warn(
                "Could not publish document search sources:",
                sourceError,
              );
            }
          }

          // --------------------------------
          // REAL TOOL END EVENT
          // --------------------------------

          sendEvent(res, {
            type: "tool_end",
            tool: toolName,
            label: getToolLabel(toolName, "end"),
            success: true,
          });

          messagesForAI.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolName,
            content: String(toolResult),
          });
        } catch (toolError) {
          console.error("Tool Execution Error:", toolError);

          // --------------------------------
          // TOOL FAILURE EVENT
          // --------------------------------

          sendEvent(res, {
            type: "tool_end",
            tool: toolName,
            label: "Tool failed",
            success: false,
          });

          messagesForAI.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolName,
            content: `Tool error: ${toolError.message}`,
          });
        }
      }

      currentResponse = await groq.chat.completions.create({
        model,
        messages: messagesForAI,
        tools,
        tool_choice: "auto",
        stream: false,
      });
    }

    // --------------------------------
    // Tool Iteration Safety
    // --------------------------------

    if (currentResponse.choices[0]?.message?.tool_calls?.length) {
      console.warn("Maximum tool iterations reached");

      messagesForAI.push({
        role: "system",
        content:
          "Tool call limit reached. Provide the best possible answer using the tool results already available. Do not call another tool.",
      });

      currentResponse = await groq.chat.completions.create({
        model,
        messages: messagesForAI,
        tools: [],
        tool_choice: "none",
        stream: false,
      });
    }

    // --------------------------------
    // Final Response
    // --------------------------------

    const finalMessage = currentResponse.choices[0]?.message;

    if (!finalMessage) {
      throw new Error("AI returned an empty response");
    }

    // --------------------------------
    // Send AI Content Event
    // --------------------------------

    if (finalMessage.content) {
      sendEvent(res, {
        type: "content",
        content: finalMessage.content,
      });
    }

    // --------------------------------
    // Done Event
    // --------------------------------

    sendEvent(res, {
      type: "done",
    });

    res.end();
  } catch (error) {
    console.error("Groq Error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: error?.message || "Groq API request failed",
      });
    } else {
      sendEvent(res, {
        type: "error",
        message: error?.message || "Groq API request failed",
      });

      sendEvent(res, {
        type: "done",
      });

      res.end();
    }
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(
    express.static(frontendBuildDirectory, {
      setHeaders(response, filePath) {
        if (filePath.endsWith("index.html"))
          response.setHeader("Cache-Control", "no-cache");
      },
    }),
  );

  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      return res.sendFile(path.join(frontendBuildDirectory, "index.html"));
    }
    return next();
  });
}

// --------------------------------
// Server
// --------------------------------

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
