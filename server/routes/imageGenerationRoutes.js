import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { generateCloudflareImage, ImageGenerationError } from "../services/cloudflareImageService.js";

const router = express.Router();
const IMAGE_LIMIT = 5;
const IMAGE_WINDOW_MS = 15 * 60 * 1000;
const imageRequestWindows = new Map();

const imageGenerationRateLimit = (req, res, next) => {
  if (!process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || !process.env.CLOUDFLARE_API_TOKEN?.trim()) {
    return next();
  }
  const now = Date.now();
  const key = String(req.userId);
  const current = imageRequestWindows.get(key);
  const windowState = !current || now >= current.resetAt
    ? { count: 0, resetAt: now + IMAGE_WINDOW_MS }
    : current;

  if (windowState.count >= IMAGE_LIMIT) {
    res.set("Retry-After", String(Math.ceil((windowState.resetAt - now) / 1000)));
    return res.status(429).json({
      success: false,
      message: "Image generation limit reached. Try again in a few minutes.",
    });
  }

  windowState.count += 1;
  imageRequestWindows.set(key, windowState);
  if (imageRequestWindows.size > 5_000) {
    for (const [userId, state] of imageRequestWindows) {
      if (now >= state.resetAt) imageRequestWindows.delete(userId);
    }
  }
  return next();
};

router.post("/generate", authMiddleware, imageGenerationRateLimit, async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  if (!prompt) {
    return res.status(400).json({ success: false, message: "Image prompt is required." });
  }
  if (prompt.length > 1500) {
    return res.status(400).json({ success: false, message: "Image prompt must be 1,500 characters or fewer." });
  }
  const imageSizes = {
    square: [1024, 1024],
    portrait: [832, 1216],
    landscape: [1216, 832],
  };
  // Cloudflare's SDXL model accepts at most 20 inference steps.
  const imageQualitySteps = { draft: 8, standard: 14, high: 20 };
  const dimensions = imageSizes[req.body?.aspectRatio] || imageSizes.square;
  const steps = imageQualitySteps[req.body?.quality] || imageQualitySteps.standard;
  console.info("Image generation request received", { userId: req.userId, promptLength: prompt.length });

  try {
    const result = await generateCloudflareImage({ prompt, dimensions, steps });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    const safeError = error instanceof ImageGenerationError
      ? error
      : new ImageGenerationError("unexpected", "The image service is temporarily unavailable. Please try again shortly.", 502);
    // Never log upstream response bodies, raw exception messages, or credentials.
    console.warn("Image generation failed", { code: safeError.code, upstreamStatus: safeError.upstreamStatus || null });
    return res.status(safeError.statusCode).json({
      success: false,
      message: safeError.message,
    });
  }
});

export default router;
