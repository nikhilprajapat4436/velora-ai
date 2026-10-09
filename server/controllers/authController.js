import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { OAuth2Client } from "google-auth-library";
import Chat from "../models/Chat.js";
import ChatImage from "../models/ChatImage.js";
import Document from "../models/Document.js";
import Memory from "../models/Memory.js";

const googleClient = new OAuth2Client();

export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      provider: "local",
    });

    const token = jwt.sign(
      { userId: user._id, tokenVersion: user.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);

    res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { userId: user._id, tokenVersion: user.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider,
      },
    });
  } catch (error) {
    console.error("Login Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email_verified) {
      return res.status(401).json({ success: false, message: "Your Google email is not verified" });
    }

    const {
      sub: googleId,
      name,
      email,
      picture: avatar,
    } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        googleId,
        avatar,
        provider: "google",
      });
    } else if (!user.googleId) {
      user.googleId = googleId;
      user.avatar = avatar || user.avatar;
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id, tokenVersion: user.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: "Google login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider,
      },
    });
  } catch (error) {
    console.error("Google Login Error:", error);

    res.status(401).json({
      success: false,
      message: "Google authentication failed",
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const avatar = req.body.avatar;
    const allowedAvatars = ["🌙", "🚀", "🦊", "🐼", "🐯", "🐸", "🐧", "🐨"];

    if (name.length < 2 || name.length > 40) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 2 and 40 characters",
      });
    }

    const update = { name };

    if (avatar !== undefined) {
      const isPreset = typeof avatar === "string" &&
        avatar.startsWith("preset:") &&
        allowedAvatars.includes(avatar.slice("preset:".length));
      const isHttpsImage = typeof avatar === "string" &&
        avatar.startsWith("https://") &&
        avatar.length <= 2048;

      if (avatar !== null && !isPreset && !isHttpsImage) {
        return res.status(400).json({
          success: false,
          message: "Choose a valid profile avatar",
        });
      }

      update.avatar = avatar;
    }

    const user = await User.findByIdAndUpdate(req.userId, update, {
      new: true,
      runValidators: true,
      select: "name email avatar provider",
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider,
      },
    });
  } catch (error) {
    console.error("Profile Update Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ success: false, message: "New password must be 8 to 128 characters long." });
    }
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (!user.password) {
      return res.status(400).json({ success: false, message: "This account uses Google sign-in and has no app password." });
    }
    if (typeof currentPassword !== "string" || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ success: false, message: "Current password is incorrect." });
    }
    user.password = await bcrypt.hash(newPassword, 12);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    return res.status(200).json({ success: true, message: "Password changed. Sign in again on your devices." });
  } catch (error) {
    console.error("Change Password Error:", error);
    return res.status(500).json({ success: false, message: "Could not change password." });
  }
};

export const logoutAllSessions = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.userId, { $inc: { tokenVersion: 1 } }, { new: true }).select("_id");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    return res.status(200).json({ success: true, message: "Signed out from all devices." });
  } catch (error) {
    console.error("Revoke Sessions Error:", error);
    return res.status(500).json({ success: false, message: "Could not sign out other sessions." });
  }
};

export const exportUserData = async (req, res) => {
  try {
    const [user, chats, documents, memories, images] = await Promise.all([
      User.findById(req.userId).select("name email avatar provider createdAt").lean(),
      Chat.find({ userId: req.userId }).lean(),
      Document.find({ userId: req.userId }).lean(),
      Memory.find({ userId: req.userId }).lean(),
      ChatImage.find({ userId: req.userId }).select("sha256 type base64 createdAt").lean(),
    ]);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    return res.status(200).json({ success: true, exportedAt: new Date().toISOString(), user, chats, documents, memories, images });
  } catch (error) {
    console.error("Export User Data Error:", error);
    return res.status(500).json({ success: false, message: "Could not export account data." });
  }
};

export const deleteUserAccount = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    const confirmation = typeof req.body?.confirmation === "string" ? req.body.confirmation.trim() : "";
    if (confirmation.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(400).json({ success: false, message: "Enter your account email to confirm deletion." });
    }
    if (user.password) {
      if (typeof req.body?.password !== "string" || !(await bcrypt.compare(req.body.password, user.password))) {
        return res.status(401).json({ success: false, message: "Your password is incorrect." });
      }
    }
    await Promise.all([
      Chat.deleteMany({ userId: req.userId }),
      ChatImage.deleteMany({ userId: req.userId }),
      Document.deleteMany({ userId: req.userId }),
      Memory.deleteMany({ userId: req.userId }),
    ]);
    await User.deleteOne({ _id: req.userId });
    return res.status(200).json({ success: true, message: "Account and associated data deleted." });
  } catch (error) {
    console.error("Delete Account Error:", error);
    return res.status(500).json({ success: false, message: "Could not delete account data." });
  }
};
