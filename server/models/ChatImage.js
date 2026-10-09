import mongoose from "mongoose";

const chatImageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sha256: { type: String, required: true },
    type: { type: String, required: true },
    base64: { type: String, required: true },
  },
  { timestamps: true },
);

chatImageSchema.index({ userId: 1, sha256: 1 }, { unique: true });

export default mongoose.model("ChatImage", chatImageSchema);
