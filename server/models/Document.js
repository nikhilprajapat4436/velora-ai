import mongoose from "mongoose";

const chunkSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
    },

    chunkIndex: {
      type: Number,
      required: true,
    },
    embedding: {
      type: [Number],
      default: [],
    },
  },
  {
    _id: false,
  },
);

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    pages: {
      type: Number,
      default: 0,
    },

    chunks: {
      type: [chunkSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

const Document = mongoose.model("Document", documentSchema);

export default Document;
