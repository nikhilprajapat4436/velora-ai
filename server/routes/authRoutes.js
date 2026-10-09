import express from "express";
import {
  registerUser,
  loginUser,
  googleLogin,
  updateProfile,
  changePassword,
  logoutAllSessions,
  exportUserData,
  deleteUserAccount,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/google", googleLogin);
router.put("/profile", authMiddleware, updateProfile);
router.put("/password", authMiddleware, changePassword);
router.post("/logout-all", authMiddleware, logoutAllSessions);
router.get("/export", authMiddleware, exportUserData);
router.delete("/account", authMiddleware, deleteUserAccount);

export default router;
