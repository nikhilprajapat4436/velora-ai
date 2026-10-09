import Sidebar from "./components/Sidebar/Sidebar";
import Chat from "./components/Chat/Chat";
import LoginPage from "./pages/LoginPage";
import Documents from "./components/Documents/Documents";
import RegisterPage from "./pages/RegisterPage";
import AuthIntro from "./components/Auth/AuthIntro";
import LoadingAnimation from "./components/LoadingAnimation";
import { applyThemePalette, getSavedThemePalette } from "./themePalettes";
import { apiUrl } from "./api";
import { lazy, Suspense, useState, useRef, useEffect, useMemo, useCallback } from "react";

const Settings = lazy(() => import("./components/Settings/Settings"));

const titleFromMessages = (messages) => {
  const firstUserMessage = messages.find((message) => message.role === "user");
  const text = firstUserMessage?.content || messages[0]?.content || "New Conversation";
  return text.length > 35 ? `${text.slice(0, 35)}...` : text;
};

const localChatStorageKey = (userId) => `ai-assistant-chats:${userId}`;

const chatTranscriptKey = (chat) => {
  const messages = chat.messages || [];
  if (!messages.length || !messages.some((message) => message.createdAt)) {
    return `id:${chat.id || chat._id}`;
  }
  return `transcript:${JSON.stringify(messages.map((message) => ({
    role: message.role,
    content: message.content || "",
    createdAt: message.createdAt || "",
    image: Boolean(message.image),
    document: message.document?.name || false,
  })))}`;
};

const dedupeChats = (items) => {
  const seen = new Set();
  return items.filter((chat) => {
    const key = chatTranscriptKey(chat);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const newConversationKey = (messages) => {
  const firstUserMessage = messages.find((message) => message.role === "user");
  if (!firstUserMessage) return null;
  return `${firstUserMessage.createdAt || ""}:${firstUserMessage.content || ""}`;
};

const loadLocalChatCache = () => {
  try {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!storedUser?.id) return { chats: [], draft: [] };
    const scopedCache = localStorage.getItem(localChatStorageKey(storedUser.id));
    const cache = JSON.parse(scopedCache || "null");
    if (Array.isArray(cache)) return { chats: cache, draft: [] };
    if (!scopedCache) {
      const legacyCache = JSON.parse(localStorage.getItem("ai-assistant-chats") || "[]");
      if (Array.isArray(legacyCache)) {
        const ownedChats = legacyCache.filter((chat) => String(chat.userId || "") === String(storedUser.id));
        if (ownedChats.length) return { chats: ownedChats, draft: [] };
      }
    }
    return {
      chats: Array.isArray(cache?.chats) ? cache.chats : [],
      draft: Array.isArray(cache?.draft) ? cache.draft : [],
    };
  } catch {
    return { chats: [], draft: [] };
  }
};

function App() {
  useEffect(() => {
    applyThemePalette(getSavedThemePalette());
  }, []);
  const [messages, setMessages] = useState(() => loadLocalChatCache().draft);
  const [isThinking, setIsThinking] = useState(false);
  const [chatSaveStatus, setChatSaveStatus] = useState("saved");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [chats, setChats] = useState(() => dedupeChats(loadLocalChatCache().chats));
  const [activeChatId, setActiveChatId] = useState(null);
  const [deleteChat, setDeleteChat] = useState(null);
  const [authPage, setAuthPage] = useState("login");
  const [authIntroStage, setAuthIntroStage] = useState(() =>
    localStorage.getItem("token") || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
      ? "done"
      : "intro",
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("token"),
  );
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });

  const cancelRequestRef = useRef(null);
  const creatingChatRef = useRef(false);
  const chatCreationPromiseRef = useRef(null);
  const createdUnassignedChatRef = useRef(null);
  const chatSelectionVersionRef = useRef(0);
  const updateChatTimeoutRef = useRef(null);
  const chatSaveQueueRef = useRef(new Map());
  const chatImageAssetsRef = useRef(new Map());

  useEffect(() => {
    if (isAuthenticated || authIntroStage !== "intro") return undefined;
    const timer = window.setTimeout(() => setAuthIntroStage("reveal"), 1650);
    return () => window.clearTimeout(timer);
  }, [authIntroStage, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated || authIntroStage !== "reveal") return undefined;
    const timer = window.setTimeout(() => setAuthIntroStage("done"), 700);
    return () => window.clearTimeout(timer);
  }, [authIntroStage, isAuthenticated]);

  const chatsWithCurrentMessages = useMemo(
    () => dedupeChats(
      activeChatId
        ? chats.map((chat) =>
            chat.id === activeChatId
              ? { ...chat, messages }
              : chat,
          )
        : chats,
    ),
    [activeChatId, chats, messages],
  );

  useEffect(() => {
    const handleInstallAvailable = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", handleInstallAvailable);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallAvailable);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  // Save new chat to MongoDB
  const saveChatToDatabase = useCallback(async (chat) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) return null;
      setChatSaveStatus("saving");

      const response = await fetch(apiUrl("/api/chats"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: chat.title,
          messages: chat.messages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save chat");
      }

      setChatSaveStatus("saved");
      chatImageAssetsRef.current.set(
        data.chat._id,
        (data.chat.messages || []).map((message) => message.image?.assetId ? String(message.image.assetId) : null),
      );

      return {
        ...data.chat,
        id: data.chat._id,
      };
    } catch (error) {
      console.error("Save Chat Error:", error);
      setChatSaveStatus("error");
      return null;
    }
  }, []);

  // Update existing chat in MongoDB
  const updateChatInDatabase = useCallback(async (chatId, chatMessages) => {
    const token = localStorage.getItem("token");
    if (!token || !chatId) return null;

    setChatSaveStatus("saving");
    const previousSave = chatSaveQueueRef.current.get(chatId) || Promise.resolve();
    const currentSave = previousSave.catch(() => null).then(async () => {
      const knownAssets = chatImageAssetsRef.current.get(chatId) || [];
      const messagesToSave = chatMessages.map((message, index) => {
        if (!message.image) return message;
        const image = { ...message.image };
        const assetId = image.assetId || knownAssets[index];
        if (assetId) {
          image.assetId = assetId;
          delete image.data;
        }
        return { ...message, image };
      });
      const response = await fetch(apiUrl(`/api/chats/${chatId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: messagesToSave }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to update chat");
      chatImageAssetsRef.current.set(
        chatId,
        (data.chat.messages || []).map((message) => message.image?.assetId ? String(message.image.assetId) : null),
      );
      return data.chat;
    });

    chatSaveQueueRef.current.set(chatId, currentSave);
    try {
      const updatedChat = await currentSave;
      if (chatSaveQueueRef.current.get(chatId) === currentSave) setChatSaveStatus("saved");
      return updatedChat;
    } catch (error) {
      console.error("Update Chat Error:", error);
      if (chatSaveQueueRef.current.get(chatId) === currentSave) setChatSaveStatus("error");
      return null;
    } finally {
      if (chatSaveQueueRef.current.get(chatId) === currentSave) {
        chatSaveQueueRef.current.delete(chatId);
      }
    }
  }, []);

  const createChatOnce = useCallback((title, chatMessages) => {
    const conversationKey = newConversationKey(chatMessages);
    const previouslyCreated = createdUnassignedChatRef.current;
    if (conversationKey && previouslyCreated?.key === conversationKey) {
      return Promise.resolve(previouslyCreated.chat);
    }
    if (chatCreationPromiseRef.current) {
      return chatCreationPromiseRef.current;
    }

    creatingChatRef.current = true;
    const creationPromise = saveChatToDatabase({ title, messages: chatMessages })
      .then((newChat) => {
        if (newChat) {
          createdUnassignedChatRef.current = { key: conversationKey, chat: newChat };
          setChats((previousChats) => dedupeChats(
            previousChats.some((chat) => chat.id === newChat.id)
              ? previousChats
              : [...previousChats, newChat],
          ));
        }
        return newChat;
      })
      .finally(() => {
        creatingChatRef.current = false;
        if (chatCreationPromiseRef.current === creationPromise) {
          chatCreationPromiseRef.current = null;
        }
      });

    chatCreationPromiseRef.current = creationPromise;
    return creationPromise;
  }, [saveChatToDatabase]);

  const persistCurrentChatSnapshot = async (snapshot, requestedChatId = activeChatId) => {
    if (!snapshot.length || !isAuthenticated) return true;

    const existingChat = chats.find((chat) => chat.id === requestedChatId);
    const title = existingChat?.title || titleFromMessages(snapshot);
    let chatId = requestedChatId;

    if (chatId) {
      setChats((previousChats) => previousChats.map((chat) =>
        chat.id === chatId ? { ...chat, title, messages: snapshot } : chat,
      ));
    }

    if (!chatId) {
      const createdChat = chatCreationPromiseRef.current
        ? await chatCreationPromiseRef.current
        : await createChatOnce(title, snapshot);
      if (!createdChat) return false;
      chatId = createdChat.id;
    }

    const updatedChat = await updateChatInDatabase(chatId, snapshot);
    if (!updatedChat) return false;

    setChats((previousChats) => previousChats.map((chat) =>
      chat.id === chatId ? { ...chat, ...updatedChat, id: chatId, messages: snapshot } : chat,
    ));
    return true;
  };

  const updateChatMetadata = async (chatId, changes) => {
    const token = localStorage.getItem("token");
    const response = await fetch(apiUrl(`/api/chats/${chatId}`), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(changes),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to update chat");
    }

    return data.chat;
  };

  const handleRenameChat = async (chatId, title) => {
    await updateChatMetadata(chatId, { title });
    setChats((previousChats) =>
      previousChats.map((chat) => (chat.id === chatId ? { ...chat, title } : chat)),
    );
  };

  const handleTogglePin = async (chatId, pinned) => {
    await updateChatMetadata(chatId, { pinned });
    setChats((previousChats) =>
      previousChats
        .map((chat) => (chat.id === chatId ? { ...chat, pinned } : chat))
        .sort((first, second) => {
          if (Boolean(first.pinned) !== Boolean(second.pinned)) {
            return Number(Boolean(second.pinned)) - Number(Boolean(first.pinned));
          }
          return new Date(second.updatedAt || 0) - new Date(first.updatedAt || 0);
        }),
    );
  };

  const handleMoveChat = async (chatId, folder) => {
    await updateChatMetadata(chatId, { folder });
    setChats((previousChats) => previousChats.map((chat) =>
      chat.id === chatId ? { ...chat, folder } : chat,
    ));
  };

  const handleDeleteChat = async (chatId) => {
    try {
      if (activeChatId === chatId) {
        chatSelectionVersionRef.current += 1;
        if (updateChatTimeoutRef.current) {
          clearTimeout(updateChatTimeoutRef.current);
          updateChatTimeoutRef.current = null;
        }
        cancelRequestRef.current?.();
      }
      const pendingSave = chatSaveQueueRef.current.get(chatId);
      if (pendingSave) await pendingSave.catch(() => null);

      const token = localStorage.getItem("token");

      if (!token) return;

      const response = await fetch(
        apiUrl(`/api/chats/${chatId}`),
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete chat");
      }

      setChats((prevChats) =>
        prevChats.filter((chat) => chat.id !== chatId),
      );

      if (activeChatId === chatId) {
        setMessages([]);
        setActiveChatId(null);
        setIsThinking(false);
      }
    } catch (error) {
      console.error("Delete Chat Error:", error);
    }
  };

  const handleAuthenticated = () => {
    try {
      setUser(JSON.parse(localStorage.getItem("user") || "null"));
    } catch {
      setUser(null);
    }
    setIsLoggingOut(false);
    setAuthIntroStage("done");
    setIsAuthenticated(true);
  };

  // New chat
  const handleNewChat = async () => {
    cancelRequestRef.current?.();

    setShowDocuments(false);
    setShowSettings(false);

    if (updateChatTimeoutRef.current) {
      clearTimeout(updateChatTimeoutRef.current);
      updateChatTimeoutRef.current = null;
    }

    const messagesToSave = messages;
    if (messagesToSave.length > 0) {
      const saved = await persistCurrentChatSnapshot(messagesToSave, activeChatId);
      if (!saved) {
        console.error("New chat cancelled: the current conversation could not be saved.");
        return;
      }
    }

    chatSelectionVersionRef.current += 1;
    setMessages([]);
    setIsThinking(false);
    setActiveChatId(null);
  };

  const retryCurrentChatSave = async () => {
    if (!messages.length) return;
    const snapshot = messages;
    const selectionVersion = chatSelectionVersionRef.current;
    let targetChatId = activeChatId;

    if (!targetChatId) {
      const createdChat = chatCreationPromiseRef.current
        ? await chatCreationPromiseRef.current
        : await createChatOnce(titleFromMessages(snapshot), snapshot);
      if (!createdChat) return;
      targetChatId = createdChat.id;
    }

    const saved = await persistCurrentChatSnapshot(snapshot, targetChatId);
    if (saved && !activeChatId && selectionVersion === chatSelectionVersionRef.current) {
      setActiveChatId(targetChatId);
    }
  };

  // Automatically save/update active chat in MongoDB
  useEffect(() => {
    if (!isAuthenticated || messages.length === 0) return;

    // If no active chat exists, create one
    if (!activeChatId) {
      if (creatingChatRef.current) return;

      creatingChatRef.current = true;
      const selectionVersion = chatSelectionVersionRef.current;

      const createChat = async () => {
        const title = titleFromMessages(messages);
        const newChat = await createChatOnce(title, messages);

        if (newChat) {
          if (
            selectionVersion ===
            chatSelectionVersionRef.current
          ) {
            setActiveChatId(newChat.id);
          }
        }

      };

      createChat();

      return;
    }

    // Debounce database updates while AI is streaming
    if (updateChatTimeoutRef.current) {
      clearTimeout(updateChatTimeoutRef.current);
    }

    updateChatTimeoutRef.current = setTimeout(() => {
      updateChatInDatabase(activeChatId, messages);
    }, 800);

    return () => {
      if (updateChatTimeoutRef.current) {
        clearTimeout(updateChatTimeoutRef.current);
      }
    };
  }, [
    messages,
    activeChatId,
    isAuthenticated,
    createChatOnce,
    updateChatInDatabase,
  ]);

  // Save text and attachment metadata locally; binary image data lives in the database asset collection.
  useEffect(() => {
    if (!user?.id) return;
    const storageKey = localChatStorageKey(user.id);
    const serializeChat = (chat) => ({
      ...chat,
      messages: (chat.messages || []).map((message) => {
        const savedMessage = { ...message };
        delete savedMessage.streamId;
        delete savedMessage.imageAnimationId;
        if (!message.image) return savedMessage;
        const imageMetadata = { ...message.image };
        delete imageMetadata.data;
        return { ...savedMessage, image: imageMetadata };
      }),
    });
    const localChats = chatsWithCurrentMessages.map(serializeChat);
    const localDraft = !activeChatId && messages.length > 0
      ? serializeChat({ id: "local-draft", title: titleFromMessages(messages), messages })
      : null;
    const cache = { chats: localChats, draft: localDraft?.messages || [] };

    try {
      localStorage.setItem(storageKey, JSON.stringify(cache));
    } catch (error) {
      console.error("Local chat backup could not be saved:", error);
      try {
        const compactChats = localChats.slice(-20).map((chat) => ({
          ...chat,
          messages: chat.messages.slice(-80),
        }));
        localStorage.setItem(storageKey, JSON.stringify({
          chats: compactChats,
          draft: (localDraft?.messages || []).slice(-80),
        }));
      } catch (fallbackError) {
        console.error("Local chat backup is full; server save remains available:", fallbackError);
      }
    }
  }, [activeChatId, chats, chatsWithCurrentMessages, messages, user?.id]);

  // Load user's chats from MongoDB
  useEffect(() => {
    if (!isAuthenticated) return;

    const controller = new AbortController();
    let isCurrent = true;
    const loadChatsFromDatabase = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) return;

        const response = await fetch(
          apiUrl("/api/chats"),
          {
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load chats",
          );
        }

        const normalizedChats = data.chats.map(
          (chat) => ({
            ...chat,
            id: chat._id,
          }),
        );

        if (isCurrent) setChats(dedupeChats(normalizedChats));
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Failed to load chats from database:", error);
        }
      }
    };

    loadChatsFromDatabase();
    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [isAuthenticated]);

  // Authentication
  if (!isAuthenticated) {
    if (authPage === "register") {
      return (
        <>
          <RegisterPage
            onLogin={() => setAuthPage("login")}
            onRegisterSuccess={handleAuthenticated}
          />
          {authIntroStage !== "done" && <AuthIntro isLeaving={authIntroStage === "reveal"} />}
        </>
      );
    }

    return (
      <>
        <LoginPage
          onRegister={() => setAuthPage("register")}
          onLoginSuccess={handleAuthenticated}
          isIntroRevealing={authIntroStage === "reveal"}
        />
        {authIntroStage !== "done" && <AuthIntro isLeaving={authIntroStage === "reveal"} />}
      </>
    );
  }

  // Logout
  const handleClearChatHistory = async () => {
    const response = await fetch(apiUrl("/api/chats"), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Could not clear chat history.");
    cancelRequestRef.current?.();
    if (updateChatTimeoutRef.current) clearTimeout(updateChatTimeoutRef.current);
    if (user?.id) localStorage.removeItem(localChatStorageKey(user.id));
    chatSelectionVersionRef.current += 1;
    setMessages([]);
    setChats([]);
    setActiveChatId(null);
    setIsThinking(false);
  };

  const handleAccountDeleted = () => {
    cancelRequestRef.current?.();
    if (user?.id) localStorage.removeItem(localChatStorageKey(user.id));
    try {
      const legacyChats = JSON.parse(localStorage.getItem("ai-assistant-chats") || "[]");
      if (Array.isArray(legacyChats)) {
        const otherUsersChats = legacyChats.filter((chat) => String(chat.userId || "") !== String(user?.id || ""));
        if (otherUsersChats.length) localStorage.setItem("ai-assistant-chats", JSON.stringify(otherUsersChats));
        else localStorage.removeItem("ai-assistant-chats");
      }
    } catch {
      localStorage.removeItem("ai-assistant-chats");
    }
    ["ai-assistant-preferences", "ai-assistant-chat-size", "ai-assistant-accent", "ai-assistant-prompt-templates"].forEach((key) => localStorage.removeItem(key));
    document.documentElement.dataset.chatSize = "default";
    delete document.documentElement.dataset.reduceMotion;
    delete document.documentElement.dataset.highContrast;
    applyThemePalette("royal-emerald");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    chatSelectionVersionRef.current += 1;
    setUser(null);
    setMessages([]);
    setChats([]);
    setActiveChatId(null);
    setShowSettings(false);
    setShowDocuments(false);
    setIsThinking(false);
    setIsAuthenticated(false);
    setAuthPage("login");
    setAuthIntroStage("reveal");
  };

  const handleLogout = (options = {}) => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    const logoutDelay = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 420;
    window.setTimeout(() => {
      if (!options?.skipSave && messages.length > 0) {
        void persistCurrentChatSnapshot(messages, activeChatId);
      }
      chatSelectionVersionRef.current += 1;
      cancelRequestRef.current?.();

      if (updateChatTimeoutRef.current) {
        clearTimeout(updateChatTimeoutRef.current);
      }

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      setMessages([]);
      setChats([]);
      setActiveChatId(null);
      setShowSettings(false);
      setShowDocuments(false);
      setAuthIntroStage("reveal");
      setIsAuthenticated(false);
      setAuthPage("login");
    }, logoutDelay);
  };

  const handleShowDocuments = () => {
    cancelRequestRef.current?.();
    setShowDocuments(true);
    setShowSettings(false);
  };
  const handleOpenChat = (chat) => {
  if (updateChatTimeoutRef.current) {
    clearTimeout(updateChatTimeoutRef.current);
    updateChatTimeoutRef.current = null;
  }
  if (messages.length > 0) {
    void persistCurrentChatSnapshot(messages, activeChatId);
  }
  chatSelectionVersionRef.current += 1;
  cancelRequestRef.current?.();

  setShowDocuments(false);
  setShowSettings(false);

  setMessages(chat.messages);
  setActiveChatId(chat.id);
};

  const handleShowSettings = () => {
    setShowSettings(true);
    setShowDocuments(false);
  };

  const handleProfileUpdated = (updatedUser) => {
    localStorage.setItem("user", JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <div className={`app${isLoggingOut ? " app-logging-out" : ""}`}>
      <Sidebar
        onNewChat={handleNewChat}
          onOpenChat={handleOpenChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onTogglePin={handleTogglePin}
        onMoveChat={handleMoveChat}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
        onSettings={handleShowSettings}
        onDocuments={handleShowDocuments}
        user={user}
        chats={chatsWithCurrentMessages}
        activeChatId={activeChatId}
        deleteChat={deleteChat}
        setDeleteChat={setDeleteChat}
      />

      {showSettings ? (
        <Suspense
          fallback={
            <div style={{ flex: 1, display: "grid", placeItems: "center" }}><LoadingAnimation message="Opening your settings…" /></div>
          }
        >
          <Settings
            user={user}
            onUserUpdated={handleProfileUpdated}
            onClearChatHistory={handleClearChatHistory}
            onLogout={handleLogout}
            onAccountDeleted={handleAccountDeleted}
            onBack={() => setShowSettings(false)}
          />
        </Suspense>
      ) : showDocuments ? (
        <Documents />
      ) : (
        <Chat
          messages={messages}
          setMessages={setMessages}
          chatSaveStatus={chatSaveStatus}
          onRetryChatSave={retryCurrentChatSave}
          canInstallApp={Boolean(installPrompt)}
          onInstallApp={handleInstallApp}
          isThinking={isThinking}
          setIsThinking={setIsThinking}
          cancelRequestRef={cancelRequestRef}
        />
      )}
    </div>
  );
}

export default App;
