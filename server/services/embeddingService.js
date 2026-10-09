import { pipeline } from "@huggingface/transformers";

let extractor = null;

const getExtractor = async () => {
  if (!extractor) {
    extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    );
  }

  return extractor;
};

const generateEmbedding = async (text) => {
  if (!text?.trim()) {
    throw new Error("Text is required for embedding");
  }

  const model = await getExtractor();

  const output = await model(text, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(output.data);
};

export default generateEmbedding;
