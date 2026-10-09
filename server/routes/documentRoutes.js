import Document from "../models/Document.js";
import express from "express";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import authMiddleware from "../middleware/authMiddleware.js";
import generateEmbedding from "../services/embeddingService.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// =========================
// GET USER DOCUMENTS
// =========================

router.get("/", authMiddleware, async (req, res) => {
  try {
    const documents = await Document.find({
      userId: req.userId,
    })
      .select("name pages chunks createdAt updatedAt")
      .sort({ createdAt: -1 });

    const formattedDocuments = documents.map((document) => ({
      id: document._id,
      name: document.name,
      pages: document.pages,
      chunks: document.chunks.length,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    }));

    res.status(200).json({
      success: true,
      documents: formattedDocuments,
    });
  } catch (error) {
    console.error("Fetch Documents Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch documents",
    });
  }
});

// =========================
// UPLOAD PDF
// =========================

router.post(
  "/upload",
  authMiddleware,
  upload.single("document"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "PDF file is required",
        });
      }

      // =========================
      // CHECK DUPLICATE PDF
      // =========================

      const existingDocument = await Document.findOne({
        userId: req.userId,
        name: req.file.originalname,
      });

      if (existingDocument) {
        return res.status(409).json({
          success: false,
          message: "This PDF has already been uploaded.",
          document: {
            id: existingDocument._id,
            name: existingDocument.name,
            pages: existingDocument.pages,
            chunks: existingDocument.chunks.length,
          },
        });
      }

      const parser = new PDFParse({
        data: req.file.buffer,
      });

      const result = await parser.getText();

      await parser.destroy();

      const pdfData = {
        text: result.text,
        numpages: result.total,
      };

      const text = pdfData.text?.trim();

      if (!text) {
        return res.status(400).json({
          success: false,
          message: "Could not extract text from this PDF",
        });
      }

      const chunkSize = 1200;
      const chunkOverlap = 200;

      const chunks = [];

      let start = 0;
      let chunkIndex = 0;

      while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);

        const chunk = text.slice(start, end).trim();

        if (chunk) {
          chunks.push({
            content: chunk,
            chunkIndex,
          });

          chunkIndex++;
        }

        start += chunkSize - chunkOverlap;
      }

      for (const chunk of chunks) {
        chunk.embedding = await generateEmbedding(chunk.content);
      }

      const document = await Document.create({
        userId: req.userId,
        name: req.file.originalname,
        pages: pdfData.numpages,
        chunks,
      });

      console.log("Pages:", pdfData.numpages);
      console.log("Extracted characters:", text.length);
      console.log("Created chunks:", chunks.length);

      res.status(200).json({
        success: true,
        message: "PDF uploaded and processed successfully",
        document: {
          id: document._id,
          name: document.name,
          pages: document.pages,
          characters: text.length,
          chunks: document.chunks.length,
        },
      });
    } catch (error) {
      console.error("PDF Upload Error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to process PDF",
      });
    }
  },
);

// =========================
// DELETE DOCUMENT
// =========================

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const document = await Document.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Delete Document Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete document",
    });
  }
});

export default router;
