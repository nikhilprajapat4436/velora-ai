import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      default: null,
    },

    googleId: {
      type: String,
      default: null,
    },

    avatar: {
      type: String,
      default: null,
    },

    tokenVersion: {
      type: Number,
      default: 0,
    },

    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;
