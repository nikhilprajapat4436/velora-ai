import { useEffect, useState } from "react";
import { Trash2, Brain, ArrowLeft, Pencil, Check, X } from "lucide-react";
import "./MemoryManagement.css";
import { apiUrl } from "../../api";
import LoadingAnimation from "../LoadingAnimation";

function MemoryManagement({ onBack }) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(() =>
    Boolean(localStorage.getItem("token")),
  );
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [showClearAll, setShowClearAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const fetchMemories = async () => {
    const token = localStorage.getItem("token");

    if (!token) return;

    try {
      const response = await fetch(apiUrl("/api/memories"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch memories");
      }

      setMemories(data.memories || []);
    } catch (error) {
      console.error("Fetch Memories Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // The loader commits state after the network request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMemories();
  }, []);

  const handleDeleteMemory = async (memoryId) => {
    try {
      setDeletingId(memoryId);

      const token = localStorage.getItem("token");

      if (!token) return;

      const response = await fetch(
        apiUrl(`/api/memories/${memoryId}`),
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete memory");
      }

      setMemories((prevMemories) =>
        prevMemories.filter((memory) => memory._id !== memoryId),
      );
    } catch (error) {
      console.error("Delete Memory Error:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveMemory = async (memoryId) => {
    const content = editingContent.trim();
    if (!content) return;

    try {
      setSavingId(memoryId);
      setActionError("");
      const response = await fetch(apiUrl(`/api/memories/${memoryId}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ content }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update memory");
      }

      setMemories((previousMemories) =>
        previousMemories.map((memory) =>
          memory._id === memoryId ? data.memory : memory,
        ),
      );
      setEditingId(null);
      setEditingContent("");
    } catch (error) {
      setActionError(error.message || "Failed to update memory");
    } finally {
      setSavingId(null);
    }
  };

  const handleClearAllMemories = async () => {
    try {
      setClearingAll(true);
      setActionError("");
      const response = await fetch(apiUrl("/api/memories"), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to clear memories");
      }

      setMemories([]);
      setShowClearAll(false);
    } catch (error) {
      setActionError(error.message || "Failed to clear memories");
      setShowClearAll(false);
    } finally {
      setClearingAll(false);
    }
  };

  return (
    <div className="memory-management">
      <div className="memory-header">
        <button type="button" className="memory-back-btn" onClick={onBack}>
          <ArrowLeft size={18} />
          <span>Back to Settings</span>
        </button>
        <div className="memory-title">
          <div className="memory-icon">
            <Brain size={20} />
          </div>

          <div>
            <h2>AI Memory</h2>
            <p>Information the AI remembers to improve future conversations.</p>
          </div>
        </div>
        {!loading && memories.length > 0 && (
          <button
            type="button"
            className="memory-clear-all-btn"
            onClick={() => setShowClearAll(true)}
          >
            <Trash2 size={15} />
            <span>Clear all</span>
          </button>
        )}
      </div>

      <div className="memory-list">
        {actionError && <p className="memory-action-error" role="alert">{actionError}</p>}
        {loading && (
          <LoadingAnimation compact message="Loading saved memories…" />
        )}

        {!loading && memories.length === 0 && (
          <div className="memory-empty">
            <Brain size={28} />
            <h3>No memories yet</h3>
            <p>
              As you chat, the AI may remember useful long-term information
              about you.
            </p>
          </div>
        )}

        {!loading &&
          memories.map((memory) => (
            <div className={`memory-card ${editingId === memory._id ? "editing" : ""}`} key={memory._id}>
              <div className="memory-content">
                {editingId === memory._id ? (
                  <textarea
                    className="memory-edit-input"
                    value={editingContent}
                    maxLength={2000}
                    aria-label="Edit saved memory"
                    onChange={(event) => setEditingContent(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setEditingId(null);
                      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault();
                        handleSaveMemory(memory._id);
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <p>{memory.content}</p>
                )}

                <div className="memory-meta">
                  <span>{memory.category}</span>
                  <span>Importance: {memory.importance}/5</span>
                </div>
              </div>

              <div className="memory-actions">
                {editingId === memory._id ? (
                  <>
                    <button
                      type="button"
                      className="memory-save-btn"
                      onClick={() => handleSaveMemory(memory._id)}
                      disabled={savingId === memory._id || !editingContent.trim()}
                      title="Save memory"
                      aria-label="Save memory"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      className="memory-cancel-btn"
                      onClick={() => setEditingId(null)}
                      disabled={savingId === memory._id}
                      title="Cancel editing"
                      aria-label="Cancel editing"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="memory-edit-btn"
                      onClick={() => {
                        setEditingId(memory._id);
                        setEditingContent(memory.content);
                        setActionError("");
                      }}
                      title="Edit memory"
                      aria-label="Edit memory"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="memory-delete-btn"
                      onClick={() => handleDeleteMemory(memory._id)}
                      disabled={deletingId === memory._id}
                      title="Delete memory"
                      aria-label="Delete memory"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
      </div>

      {showClearAll && (
        <div
          className="memory-confirm-overlay"
          onClick={() => !clearingAll && setShowClearAll(false)}
        >
          <section
            className="memory-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-memories-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="memory-confirm-icon"><Trash2 size={19} /></div>
            <h3 id="clear-memories-title">Clear all memories?</h3>
            <p>This removes all saved memories from your account. This cannot be undone.</p>
            <div className="memory-confirm-actions">
              <button
                type="button"
                className="memory-confirm-cancel"
                onClick={() => setShowClearAll(false)}
                disabled={clearingAll}
              >
                Cancel
              </button>
              <button
                type="button"
                className="memory-confirm-delete"
                onClick={handleClearAllMemories}
                disabled={clearingAll}
              >
                {clearingAll ? "Clearing..." : "Clear all"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default MemoryManagement;
