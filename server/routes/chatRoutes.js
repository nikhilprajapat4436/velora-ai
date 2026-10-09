import express from "express";
import { createHash } from "node:crypto";
import authMiddleware from "../middleware/authMiddleware.js";
import Chat from "../models/Chat.js";
import ChatImage from "../models/ChatImage.js";

const router = express.Router();

const sanitizeMessages = async (userId, messages) => {
  if (!Array.isArray(messages)) return [];

  const validMessages = messages.filter((message) =>
    message &&
    ["user", "assistant"].includes(message.role) &&
    typeof message.content === "string" &&
    message.content.trim() !== "",
  );

  return Promise.all(validMessages.map(async (message) => {
    const safeMessage = {
      role: message.role,
      content: message.content,
      sources: Array.isArray(message.sources)
        ? message.sources.filter((source) => source && typeof source.name === "string")
          .map((source) => ({ name: source.name.slice(0, 300), score: Number(source.score) || 0 }))
        : [],
      webSources: Array.isArray(message.webSources)
        ? message.webSources.filter((source) => source && typeof source.url === "string")
          .map((source) => ({
            title: typeof source.title === "string" ? source.title.slice(0, 500) : "",
            url: source.url.slice(0, 3000),
            score: Number(source.score) || 0,
          }))
        : [],
      feedback: ["up", "down"].includes(message.feedback) ? message.feedback : null,
      saved: Boolean(message.saved),
      createdAt: message.createdAt && !Number.isNaN(new Date(message.createdAt).getTime())
        ? new Date(message.createdAt)
        : new Date(),
      isError: Boolean(message.isError),
      retryMessage: typeof message.retryMessage === "string" ? message.retryMessage.slice(0, 20000) : "",
    };

    if (message.image && typeof message.image === "object") {
      const imageName = typeof message.image.name === "string" ? message.image.name.slice(0, 300) : "image";
      const dataUrl = typeof message.image.data === "string" ? message.image.data : "";
      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
      let assetId = null;

      if (message.image.assetId) {
        const asset = await ChatImage.findOne({ _id: message.image.assetId, userId }).select("_id");
        assetId = asset?._id || null;
      }

      if (!assetId && match) {
        if (match[2].length > 14_000_000) {
          throw new Error("Attached image is too large to save with this chat");
        }
        const sha256 = createHash("sha256").update(match[2]).digest("hex");
        const asset = await ChatImage.findOneAndUpdate(
          { userId, sha256 },
          { $setOnInsert: { userId, sha256, type: match[1], base64: match[2] } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        assetId = asset._id;
      }

      safeMessage.image = {
        name: imageName,
        type: typeof message.image.type === "string" ? message.image.type.slice(0, 100) : "image/*",
        assetId,
      };
    }

    if (message.document && typeof message.document === "object" && typeof message.document.name === "string") {
      safeMessage.document = {
        name: message.document.name.slice(0, 300),
        type: typeof message.document.type === "string" ? message.document.type.slice(0, 100) : "application/pdf",
        uploaded: Boolean(message.document.uploaded),
        hasQuestion: Boolean(message.document.hasQuestion),
      };
    }

    return safeMessage;
  }));
};

const includeImageData = async (chats, userId) => {
  const list = Array.isArray(chats) ? chats : [chats];
  const assetIds = list.flatMap((chat) => chat.messages || [])
    .map((message) => message.image?.assetId)
    .filter(Boolean);
  const assets = assetIds.length
    ? await ChatImage.find({ userId, _id: { $in: assetIds } }).select("type base64").lean()
    : [];
  const assetMap = new Map(assets.map((asset) => [String(asset._id), asset]));

  const hydrated = list.map((chat) => ({
    ...chat,
    messages: (chat.messages || []).map((message) => {
      const asset = message.image?.assetId && assetMap.get(String(message.image.assetId));
      return asset
        ? { ...message, image: { ...message.image, data: `data:${asset.type};base64,${asset.base64}` } }
        : message;
    }),
  }));
  return Array.isArray(chats) ? hydrated : hydrated[0];
};

router.get("/", authMiddleware, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.userId })
      .sort({ pinned: -1, updatedAt: -1 }).lean();
    const hydratedChats = await includeImageData(chats, req.userId);

    res.status(200).json({
      success: true,
      chats: hydratedChats,
    });
  } catch (error) {
    console.error("Fetch Chats Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch chats",
    });
  }
});

router.delete("/", authMiddleware, async (req, res) => {
  try {
    const result = await Chat.deleteMany({ userId: req.userId });
    await ChatImage.deleteMany({ userId: req.userId });
    return res.status(200).json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    console.error("Clear Chat History Error:", error);
    return res.status(500).json({ success: false, message: "Failed to clear chat history." });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { title, messages } = req.body;

    const validMessages = await sanitizeMessages(req.userId, messages);

    const chat = await Chat.create({
      userId: req.userId,
      title: title || "New Conversation",
      messages: validMessages,
    });

    res.status(201).json({
      success: true,
      chat: chat.toObject(),
    });
  } catch (error) {
    console.error("Create Chat Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create chat",
    });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { title, messages } = req.body;

    const validMessages = await sanitizeMessages(req.userId, messages);
    const update = { messages: validMessages };
    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim() || title.trim().length > 120) {
        return res.status(400).json({ success: false, message: "Chat title must be between 1 and 120 characters" });
      }
      update.title = title.trim();
    }

    const chat = await Chat.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.userId,
      },
      update,
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    res.status(200).json({
      success: true,
      chat: chat.toObject(),
    });
  } catch (error) {
    console.error("Update Chat Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update chat",
    });
  }
});

router.patch("/:id", authMiddleware, async (req, res) => {
  try {
    const update = {};

    if (req.body.title !== undefined) {
      const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
      if (!title || title.length > 120) {
        return res.status(400).json({
          success: false,
          message: "Chat title must be between 1 and 120 characters",
        });
      }
      update.title = title;
    }

    if (req.body.pinned !== undefined) {
      if (typeof req.body.pinned !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Pinned must be true or false",
        });
      }
      update.pinned = req.body.pinned;
    }

    if (req.body.folder !== undefined) {
      const folder = typeof req.body.folder === "string" ? req.body.folder.trim() : null;
      if (folder === null || !["", "Work", "Personal", "Study", "Ideas"].includes(folder)) {
        return res.status(400).json({
          success: false,
          message: "Choose a valid chat folder",
        });
      }
      update.folder = folder;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No chat changes were provided",
      });
    }

    const chat = await Chat.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: update },
      { returnDocument: "after", runValidators: true },
    );

    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    return res.status(200).json({ success: true, chat });
  } catch (error) {
    console.error("Update Chat Details Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update chat details",
    });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
      const chat = await Chat.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    const imageIds = chat.messages.map((message) => message.image?.assetId).filter(Boolean);
    for (const imageId of imageIds) {
      const stillUsed = await Chat.exists({ "messages.image.assetId": imageId });
      if (!stillUsed) await ChatImage.deleteOne({ _id: imageId, userId: req.userId });
    }

    res.status(200).json({
      success: true,
      message: "Chat deleted",
    });
  } catch (error) {
    console.error("Delete Chat Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete chat",
    });
  }
});

export default router;
