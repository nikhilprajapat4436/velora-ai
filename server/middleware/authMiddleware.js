import jwt from "jsonwebtoken";
import User from "../models/User.js";

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findById(decoded.userId).select("tokenVersion").lean();
    if (!user || (decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please sign in again.",
      });
    }

    req.userId = decoded.userId;

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

export default authMiddleware;
