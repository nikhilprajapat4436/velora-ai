import mongoose from "mongoose";
import Document from "../models/Document.js";
import generateEmbedding from "./embeddingService.js";

const calculateCosineSimilarity = (vectorA, vectorB) => {
  if (!vectorA?.length || !vectorB?.length) {
    return 0;
  }

  if (vectorA.length !== vectorB.length) return 0;

  const length = vectorA.length;

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return (
    dotProduct /
    (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
  );
};

const searchDocuments = async (
  userId,
  query,
  limit = 5,
) => {
  if (!userId || !query?.trim()) {
    return [];
  }

  try {
    const queryEmbedding = await generateEmbedding(query);

    const limitValue = Math.min(Math.max(Number(limit) || 5, 1), 10);
    let vectorResults = [];

    try {
      vectorResults = await Document.aggregate([
        {
          $vectorSearch: {
            index: "vector_index",
            path: "chunks.embedding",
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: limitValue,
            filter: {
              userId: new mongoose.Types.ObjectId(userId),
            },
          },
        },
        {
          $project: {
            name: 1,
            chunks: 1,
            score: {
              $meta: "vectorSearchScore",
            },
          },
        },
      ]);
    } catch (error) {
      console.error("Atlas Vector Search Error; using local fallback:", error);
    }

    const scoreChunks = (documents) => {
      const scoredChunks = [];

      for (const document of documents) {
        for (const chunk of document.chunks || []) {
          if (!chunk.embedding?.length) {
            continue;
          }

          const similarity = calculateCosineSimilarity(
            queryEmbedding,
            chunk.embedding,
          );

          scoredChunks.push({
            name: document.name,
            score: similarity,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
          });
        }
      }

      return scoredChunks;
    };

    let matchedChunks = scoreChunks(vectorResults).filter(
      (chunk) => chunk.score >= 0.35,
    );

    if (matchedChunks.length === 0) {
      const userDocuments = await Document.find({ userId })
        .select("name chunks")
        .lean();

      const fallbackChunks = scoreChunks(userDocuments).sort(
        (a, b) => b.score - a.score,
      );
      const relevantFallbackChunks = fallbackChunks.filter(
        (chunk) => chunk.score >= 0.25,
      );

      matchedChunks = relevantFallbackChunks.length > 0
        ? relevantFallbackChunks
        : fallbackChunks.slice(0, limitValue);
    }

    matchedChunks.sort(
      (a, b) => b.score - a.score,
    );

    return matchedChunks.slice(0, limitValue);
  } catch (error) {
    console.error("Document Search Error:", error);

    // Document search failure must never break normal AI chat.
    return [];
  }
};

export default searchDocuments;
