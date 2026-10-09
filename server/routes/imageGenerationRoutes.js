import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();
const DEFAULT_IMAGE_MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
const IMAGE_LIMIT = 5;
const IMAGE_WINDOW_MS = 15 * 60 * 1000;
const imageRequestWindows = new Map();

const imageGenerationRateLimit = (req, res, next) => {
  if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
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
  const imageQualitySteps = { draft: 10, standard: 20, high: 30 };
  const dimensions = imageSizes[req.body?.aspectRatio] || imageSizes.square;
  const steps = imageQualitySteps[req.body?.quality] || imageQualitySteps.standard;
  console.info("Image generation request received", { userId: req.userId, promptLength: prompt.length });

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const imageModel = process.env.CLOUDFLARE_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
  if (!accountId || !apiToken) {
    return res.status(503).json({
      success: false,
      message: "Image generation is not configured yet. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to the server .env file, then restart the backend.",
    });
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${imageModel}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          negative_prompt: "blurry, low quality, distorted, watermark",
          width: dimensions[0],
          height: dimensions[1],
          num_steps: steps,
          guidance: 7.5,
        }),
        signal: AbortSignal.timeout(120_000),
      },
    );

    if (!response.ok) {
      let providerMessage = "Cloudflare image generation failed.";
      try {
        const errorPayload = await response.json();
        const providerErrors = errorPayload.errors?.map((error) => error.message).filter(Boolean);
        if (providerErrors?.length) providerMessage = providerErrors.join(" ").slice(0, 400);
      } catch {
        // Keep a safe generic error if Cloudflare does not return JSON.
      }
      const status = response.status === 429 ? 429 : response.status === 401 || response.status === 403 ? 502 : 502;
      return res.status(status).json({ success: false, message: providerMessage });
    }

    const contentType = response.headers.get("content-type") || "";
    let imageMimeType = "image/png";
    let imageBuffer;
    if (contentType.startsWith("image/")) {
      imageMimeType = contentType.split(";")[0];
      imageBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      const payload = await response.json();
      const imageResult = payload.result?.image || payload.result;
      if (typeof imageResult !== "string" || !imageResult) {
        throw new Error("Cloudflare returned an unexpected image response.");
      }
      const base64 = imageResult.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
      imageBuffer = Buffer.from(base64, "base64");
    }

    if (!imageBuffer?.length || imageBuffer.length > 10 * 1024 * 1024) {
      throw new Error("Generated image was empty or exceeded the 10 MB save limit.");
    }

    return res.status(200).json({
      success: true,
      image: `data:${imageMimeType};base64,${imageBuffer.toString("base64")}`,
      mimeType: imageMimeType,
      model: imageModel,
    });
  } catch (error) {
    console.error("Image generation error:", error.message);
    const isTimeout = error.name === "TimeoutError" || error.name === "AbortError";
    return res.status(isTimeout ? 504 : 502).json({
      success: false,
      message: isTimeout ? "Image generation timed out. Please try again." : error.message || "Image generation failed. Please try again.",
    });
  }
});

export default router;
