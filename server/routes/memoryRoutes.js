import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import Memory from "../models/Memory.js";

const router = express.Router();

// Get all memories of logged-in user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const memories = await Memory.find({
      userId: req.userId,
    }).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      memories,
    });
  } catch (error) {
    console.error("Fetch Memories Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch memories",
    });
  }
});

// Create memory
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      content,
      category,
      importance,
    } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Memory content is required",
      });
    }

    const memory = await Memory.create({
      userId: req.userId,
      content: content.trim(),
      category: category || "other",
      importance: importance || 3,
    });

    res.status(201).json({
      success: true,
      memory,
    });
  } catch (error) {
    console.error("Create Memory Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create memory",
    });
  }
});

// Update saved memory text.
router.patch("/:id", authMiddleware, async (req, res) => {
  try {
    const content = typeof req.body.content === "string"
      ? req.body.content.trim()
      : "";

    if (!content || content.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Memory text must be between 1 and 2000 characters",
      });
    }

    const memory = await Memory.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { content } },
      { returnDocument: "after", runValidators: true },
    );

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found",
      });
    }

    return res.status(200).json({ success: true, memory });
  } catch (error) {
    console.error("Update Memory Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update memory",
    });
  }
});

// Delete memory
router.delete("/", authMiddleware, async (req, res) => {
  try {
    const result = await Memory.deleteMany({ userId: req.userId });

    return res.status(200).json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Clear Memories Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear memories",
    });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const memory = await Memory.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Memory deleted",
    });
  } catch (error) {
    console.error("Delete Memory Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete memory",
    });
  }
});

export default router;
