import "dotenv/config";
import Groq from "groq-sdk";
import Memory from "../models/Memory.js";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const extractJson = (text) => {
  if (!text) {
    return null;
  }

  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(
        cleaned.slice(start, end + 1),
      );
    } catch {
      return null;
    }
  }
};

const detectAndSaveMemory = async (
  userId,
  userMessage,
) => {
  try {
    if (!userId || !userMessage?.trim()) {
      return null;
    }

    const response =
      await groq.chat.completions.create({
        model: "openai/gpt-oss-20b",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `
You are a memory detection system.

Determine whether the user's message contains useful long-term information that should be remembered.

Save only information that can genuinely improve future conversations.

Good examples:
- User preferences
- Long-term goals
- Ongoing projects
- Stable working preferences
- Important recurring context

Do NOT save:
- Temporary questions
- Random facts
- One-time requests
- Secrets or passwords
- API keys
- Financial information
- Sensitive personal information

Return ONLY a JSON object.

If there is nothing worth remembering:
{
  "shouldSave": false
}

If something should be remembered:
{
  "shouldSave": true,
  "content": "short memory statement",
  "category": "preference",
  "importance": 3
}

category must be one of:
preference
personal
project
goal
other

importance must be between 1 and 5.
`,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
      });

    const rawContent =
      response.choices?.[0]?.message?.content?.trim();

    if (!rawContent) {
      return null;
    }

    const memoryData = extractJson(
      rawContent,
    );

    if (!memoryData) {
      console.warn(
        "Memory AI returned invalid JSON. Skipping memory save.",
      );

      return null;
    }

    if (
      memoryData.shouldSave !== true ||
      !memoryData.content?.trim()
    ) {
      return null;
    }

    const existingMemory =
      await Memory.findOne({
        userId,
        content: memoryData.content.trim(),
      });

    if (existingMemory) {
      return existingMemory;
    }

    const memory =
      await Memory.create({
        userId,
        content: memoryData.content.trim(),
        category:
          memoryData.category || "other",
        importance: Math.min(
          5,
          Math.max(
            1,
            Number(memoryData.importance) || 3,
          ),
        ),
      });

    return memory;
  } catch (error) {
    // Memory is an optional background feature.
    // It must never break the main AI chat.
    console.error(
      "Memory Detection Error:",
      error,
    );

    return null;
  }
};

export default detectAndSaveMemory;