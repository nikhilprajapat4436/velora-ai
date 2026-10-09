import mongoose from "mongoose";

const memorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      enum: [
        "preference",
        "personal",
        "project",
        "goal",
        "other",
      ],
      default: "other",
    },

    importance: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
  },
  {
    timestamps: true,
  },
);

const Memory = mongoose.model("Memory", memorySchema);

export default Memory;