import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import searchWeb from "../services/webSearchService.js";

const router = express.Router();

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const results = await searchWeb(query, {
      maxResults: 5,
    });

    res.status(200).json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Web Search Error:", error);

    res.status(500).json({
      success: false,
      message: "Web search failed",
    });
  }
});

export default router;
