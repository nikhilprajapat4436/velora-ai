import searchDocuments from "./vectorSearchService.js";

const searchDocumentTool = async ({
  userId,
  query,
  maxResults = 5,
}) => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!query || typeof query !== "string") {
    throw new Error("Document search query is required");
  }

  const safeMaxResults = Math.min(
    Math.max(Number(maxResults) || 5, 1),
    5,
  );

  const results = await searchDocuments(
    userId,
    query.trim(),
    safeMaxResults,
  );

  return {
    query: query.trim(),
    results: results || [],
    count: results?.length || 0,
  };
};

export default searchDocumentTool;