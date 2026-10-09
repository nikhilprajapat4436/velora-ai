import { useState } from "react";
import { apiUrl } from "../api";

export default function DocumentSearchTest() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    try {
      setLoading(true);

      const token = localStorage.getItem("token");
      const response = await fetch(
        
        apiUrl("/api/documents/search"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            query,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Search failed");
      }

      setResults(data.results || []);
    } catch (error) {
      console.error("Vector Search Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Ask something from your PDF"
      />

      <button
        type="button"
        onClick={handleSearch}
        disabled={loading}
        style={{background:"white"}}
      >
        {loading ? "Searching..." : "Search PDF"}
      </button>

      <pre>
        {JSON.stringify(results, null, 2)}
      </pre>
    </div>
  );
}
