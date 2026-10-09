import "dotenv/config";

const SEARXNG_URL = process.env.SEARXNG_URL || "http://localhost:8080";

const searchWeb = async (query, options = {}) => {
  if (!query?.trim()) return [];

  const maxResults = options.maxResults || 5;

  try {
    const url = new URL("/search", SEARXNG_URL);

    url.searchParams.set("q", query.trim());
    url.searchParams.set("format", "json");
    url.searchParams.set("categories", options.categories || "general");

    if (options.timeRange) {
      url.searchParams.set("time_range", options.timeRange);
    }

    if (options.language) {
      url.searchParams.set("language", options.language);
    }

    const response = await fetch(url);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.message || `SearXNG web search failed (${response.status})`
      );
    }

    return (data.results || [])
      .slice(0, maxResults)
      .map((result) => ({
        title: result.title || "",
        url: result.url || "",
        content: result.content || "",
        score: result.score || 0,
      }));
  } catch (error) {
    console.error("SearXNG Search Error:", error);
    throw error;
  }
};

export default searchWeb;
