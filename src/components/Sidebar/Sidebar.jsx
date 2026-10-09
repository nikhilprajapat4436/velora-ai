import "./Sidebar.css";
import { useEffect, useState } from "react";
import {
  Plus,
  MessageSquare,
  Settings,
  Trash2,
  Menu,
  X,
  LogOut,
  FileText,
  Search,
  Pencil,
  Pin,
  Check,
  Folder,
} from "lucide-react";

const chatFolders = ["Work", "Personal", "Study", "Ideas"];

function Sidebar({
  onNewChat,
  onOpenChat,
  onDeleteChat,
  onRenameChat,
  onTogglePin,
  onMoveChat,
  onLogout,
  isLoggingOut = false,
  onSettings,
  onDocuments,
  user,
  chats,
  activeChatId,
  deleteChat,
  setDeleteChat,
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [chatQuery, setChatQuery] = useState("");
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [chatActionError, setChatActionError] = useState("");
  const [failedAvatarUrl, setFailedAvatarUrl] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const avatarUrl = user?.avatar || user?.picture || user?.photoURL || user?.image;
  const avatarPreset = avatarUrl?.startsWith("preset:")
    ? avatarUrl.slice("preset:".length)
    : null;
  const normalizedChatQuery = chatQuery.trim().toLowerCase();
  const filteredChats = chats.filter((chat) => {
    if (folderFilter !== "all" && (chat.folder || "") !== folderFilter) return false;
    if (!normalizedChatQuery) return true;

    const titleMatches = chat.title
      ?.toLowerCase()
      .includes(normalizedChatQuery);
    const messageMatches = chat.messages?.some(
      (message) =>
        typeof message.content === "string" &&
        message.content.toLowerCase().includes(normalizedChatQuery),
    );

    return titleMatches || messageMatches;
  });

  const submitRename = async (event, chatId) => {
    event.preventDefault();
    const title = editingTitle.trim();
    if (!title) return;

    try {
      setChatActionError("");
      await onRenameChat(chatId, title);
      setEditingChatId(null);
      setEditingTitle("");
    } catch (error) {
      setChatActionError(error.message || "Could not rename chat.");
    }
  };

  const togglePin = async (chat) => {
    try {
      setChatActionError("");
      await onTogglePin(chat.id, !chat.pinned);
    } catch (error) {
      setChatActionError(error.message || "Could not update pinned chat.");
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setDeleteChat(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setDeleteChat]);

  return (
    <>
      {!isMobileOpen && (
        <button
          className="mobile-menu-btn"
          type="button"
          aria-label="Open navigation menu"
          onClick={() => setIsMobileOpen(true)}
        >
          <Menu size={21} />
        </button>
      )}

      {isMobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${isMobileOpen ? "mobile-open" : ""}`}>
        <button
          className="mobile-close-btn"
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setIsMobileOpen(false)}
        >
          <X size={21} />
        </button>

        <div className="sidebar-top">
          <button
            className="new-chat-btn"
            type="button"
            onClick={() => {
              onNewChat();
              setIsMobileOpen(false);
            }}
          >
            <Plus size={18} />
            <span>New Chat</span>
          </button>

          <button
            className="new-chat-btn documents-sidebar-btn"
            type="button"
            onClick={() => {
              onDocuments();
              setIsMobileOpen(false);
            }}
          >
            <FileText size={18} />
            <span>Documents</span>
          </button>
        </div>

        <div className="chat-history">
          <p className="chat-history-title">
            <MessageSquare size={16} />
            <span>Chat History</span>
          </p>

          <label className="chat-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={chatQuery}
              onChange={(event) => setChatQuery(event.target.value)}
              placeholder="Search chats"
              aria-label="Search chat history"
            />
            {chatQuery && (
              <button
                type="button"
                className="chat-search-clear"
                onClick={() => setChatQuery("")}
                aria-label="Clear chat search"
              >
                <X size={14} />
              </button>
            )}
          </label>

          {chats.length === 0 && !normalizedChatQuery && (
            <div className="empty-chat-history">
              <MessageSquare size={20} />
              <p>No conversations yet</p>
              <span>Start a new chat to begin.</span>
            </div>
          )}

          <label className="chat-folder-filter">
            <Folder size={14} aria-hidden="true" />
            <select aria-label="Filter chats by folder" value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)}>
              <option value="all">All folders</option>
              <option value="">Unfiled</option>
              {chatFolders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
            </select>
          </label>

          {(normalizedChatQuery || folderFilter !== "all") && filteredChats.length === 0 && (
            <div className="empty-chat-history chat-search-empty">
              <Search size={20} />
              <p>No matching chats</p>
              <span>Try another title or clear your search.</span>
            </div>
          )}

          {chatActionError && (
            <p className="chat-action-error" role="alert">
              {chatActionError}
            </p>
          )}

          {filteredChats.map((chat) => (
            <div className="chat-item-wrapper" key={chat.id}>
              {editingChatId === chat.id ? (
                <form
                  className="chat-rename-form"
                  onSubmit={(event) => submitRename(event, chat.id)}
                >
                  <input
                    autoFocus
                    value={editingTitle}
                    maxLength={120}
                    aria-label="New chat title"
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setEditingChatId(null);
                    }}
                  />
                  <button type="submit" className="chat-row-action" aria-label="Save chat title">
                    <Check size={15} />
                  </button>
                  <button
                    type="button"
                    className="chat-row-action"
                    aria-label="Cancel renaming"
                    onClick={() => setEditingChatId(null)}
                  >
                    <X size={15} />
                  </button>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    className={`chat-item ${activeChatId === chat.id ? "active" : ""}`}
                    onClick={() => {
                      onOpenChat(chat);
                      setIsMobileOpen(false);
                    }}
                  >
                    <span className="chat-item-title">{chat.title}</span>
                    {chat.folder && <span className="chat-folder-badge">{chat.folder}</span>}
                    {normalizedChatQuery && (() => {
                      const match = chat.messages?.find((message) =>
                        typeof message.content === "string" && message.content.toLowerCase().includes(normalizedChatQuery),
                      );
                      return match ? <span className="chat-search-snippet">{match.content.slice(0, 92)}</span> : null;
                    })()}
                  </button>

                  <label className="chat-folder-select" title="Move chat to folder">
                    <Folder size={13} aria-hidden="true" />
                    <select
                      aria-label={`Folder for ${chat.title}`}
                      value={chat.folder || ""}
                      onChange={async (event) => {
                        try {
                          setChatActionError("");
                          await onMoveChat(chat.id, event.target.value);
                        } catch (error) {
                          setChatActionError(error.message || "Could not move chat.");
                        }
                      }}
                    >
                      <option value="">No folder</option>
                      {chatFolders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
                    </select>
                  </label>

                  <button
                    type="button"
                    className={`chat-row-action chat-pin-btn ${chat.pinned ? "pinned" : ""}`}
                    aria-label={chat.pinned ? "Unpin chat" : "Pin chat"}
                    aria-pressed={Boolean(chat.pinned)}
                    title={chat.pinned ? "Unpin chat" : "Pin chat"}
                    onClick={() => togglePin(chat)}
                  >
                    <Pin size={14} />
                  </button>
                  <button
                    type="button"
                    className="chat-row-action chat-rename-btn"
                    aria-label="Rename chat"
                    title="Rename chat"
                    onClick={() => {
                      setEditingChatId(chat.id);
                      setEditingTitle(chat.title || "");
                      setChatActionError("");
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="chat-delete-btn"
                    aria-label="Delete chat"
                    title="Delete chat"
                    onClick={() => setDeleteChat(chat.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          {user && (
            <section className="sidebar-account" aria-label="Account">
              <p className="sidebar-section-label">ACCOUNT</p>
              <div className="sidebar-user">
                <div className="sidebar-user-avatar" aria-hidden="true">
                  {avatarPreset ? (
                    <span className="sidebar-user-avatar-emoji">{avatarPreset}</span>
                  ) : avatarUrl && failedAvatarUrl !== avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      onError={() => setFailedAvatarUrl(avatarUrl)}
                    />
                  ) : (
                    user.name?.trim()?.charAt(0).toUpperCase() || "U"
                  )}
                </div>

                <div className="sidebar-user-info">
                  <strong title={user.name}>{user.name || "Your account"}</strong>
                  <span title={user.email}>{user.email}</span>
                </div>
              </div>
            </section>
          )}

          <button
            className="settings-btn"
            type="button"
            onClick={() => {
              onSettings();
              setIsMobileOpen(false);
            }}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>

          <button
            className="settings-btn logout-btn"
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
            aria-busy={isLoggingOut}
          >
            <LogOut size={18} />
            <span>{isLoggingOut ? "Signing out…" : "Logout"}</span>
          </button>
        </div>

        {deleteChat && (
          <div
            className="delete-modal-overlay"
            onClick={() => setDeleteChat(null)}
          >
            <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
              <div className="delete-modal-icon">!</div>

              <h3>Delete Chat?</h3>

              <p>Are you sure you want to delete this conversation?</p>

              <div className="delete-modal-actions">
                <button
                  type="button"
                  className="cancel-delete-btn"
                  onClick={() => setDeleteChat(null)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="confirm-delete-btn"
                  onClick={async () => {
                    await onDeleteChat(deleteChat);
                    setDeleteChat(null);
                  }}
                >
                  Delete Chat
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

export default Sidebar;
