import mongoose from "mongoose";

const sourceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    score: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  },
);

const webSourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "",
    },

    url: {
      type: String,
      required: true,
    },

    score: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  },
);

const imageAttachmentSchema = new mongoose.Schema(
  {
    name: { type: String, default: "image" },
    type: { type: String, default: "image/*" },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatImage", default: null },
  },
  { _id: false },
);

const documentAttachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, default: "application/pdf" },
    uploaded: { type: Boolean, default: false },
    hasQuestion: { type: Boolean, default: false },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },

    content: {
      type: String,
      required: true,
    },

    feedback: {
      type: String,
      enum: ["up", "down", null],
      default: null,
    },
    saved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },

    image: { type: imageAttachmentSchema, default: null },
    document: { type: documentAttachmentSchema, default: null },
    isError: { type: Boolean, default: false },
    retryMessage: { type: String, default: "" },

    sources: {
      type: [sourceSchema],
      default: [],
    },

    webSources: {
      type: [webSourceSchema],
      default: [],
    },
  },
  {
    _id: false,
  },
);

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      default: "New Conversation",
    },

    pinned: {
      type: Boolean,
      default: false,
    },

    folder: {
      type: String,
      enum: ["", "Work", "Personal", "Study", "Ideas"],
      default: "",
    },

    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

const Chat = mongoose.model(
  "Chat",
  chatSchema,
);

export default Chat;
