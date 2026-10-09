import Memory from "../models/Memory.js";

const searchMemory = async ({
  userId,
  query,
  maxResults = 10,
}) => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const safeMaxResults = Math.min(
    Math.max(Number(maxResults) || 10, 1),
    10,
  );

  const filter = {
    userId,
  };

  if (query && typeof query === "string" && query.trim()) {
    filter.content = {
      $regex: query.trim(),
      $options: "i",
    };
  }

  const memories = await Memory.find(filter)
    .sort({
      importance: -1,
      updatedAt: -1,
    })
    .limit(safeMaxResults)
    .lean();

  return {
    query: query?.trim() || null,
    count: memories.length,
    memories: memories.map((memory) => ({
      id: memory._id,
      content: memory.content,
      importance: memory.importance,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    })),
  };
};

export default searchMemory;