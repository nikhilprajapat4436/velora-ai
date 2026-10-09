import "./Chat.css";

import {
  Sparkles,
  Globe,
  Coins,
  CloudSun,
  Calculator,
  FileSearch,
  Brain,
  Code2,
  LoaderCircle,
  Download,
  Copy,
  FileText,
  Printer,
  Keyboard,
  MoreVertical,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  Bookmark,
} from "lucide-react";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

const Message = lazy(() => import("../Message/Message"));

import InputBox from "../InputBox/InputBox";
import { apiUrl } from "../../api";
import NeuralBackdrop from "./NeuralBackdrop";
import ImageCreationCanvas from "./ImageCreationCanvas";

const getResponsePreferences = () => {
  const defaults = { sendOnEnter: true, autoScroll: true, memoryEnabled: true, reduceMotion: false, highContrast: false, imageAspectRatio: "square", imageQuality: "standard", notifications: false };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem("ai-assistant-preferences") || "{}") };
  } catch {
    return defaults;
  }
};

const getImageGenerationPrompt = (message) => {
  const text = String(message || "").trim();
  const hasImageType = /\b(?:image|picture|photo|illustration|artwork|logo|tasveer)\b/i.test(text);
  const hasGenerationVerb = /\b(?:generate|create|draw|make|paint|design|illustrate|banao|bana|banado|banaye|banaaiye)\b/i.test(text);
  const explicitVisualAction = /\b(?:draw|paint|sketch|illustrate|render)\b/i.test(text);
  const asksForImage = /\b(?:i want|i need|make me|show me|give me|can you|could you|please make|please create|mujhe|mere liye)\b[\s\S]{0,100}\b(?:image|picture|photo|illustration|artwork|logo|tasveer)\b/i.test(text);
  const informationalQuestion = /^\s*(?:how|why|what is|what are|tell me how|explain|steps|tutorial|guide|kaise|kyon|kyu|kya hota)\b/i.test(text);
  if ((!hasImageType && !explicitVisualAction) || (!hasGenerationVerb && !asksForImage) || informationalQuestion) return null;

  const prompt = text
    .replace(/^\s*(?:please\s+)?(?:can|could|would)\s+you\s+/i, "")
    .replace(/^\s*(?:please\s+)?(?:i want(?: you to)?|i need|make(?: me)?|create|generate|draw|paint|design|illustrate|show me|give me|mujhe)\s+/i, "")
    .replace(/^\s*(?:an?\s+)?(?:image|picture|photo|illustration|artwork|logo|tasveer)\s+(?:of|showing|with|for|ki)?\s*/i, "")
    .replace(/^\s*(?:please\s+)?(?:image|picture|photo|tasveer)\s+(?:banao|bana(?:o|na)|generate(?:\s+karo)?|create(?:\s+karo)?)\s*/i, "")
    .replace(/^[:\-–—,\s]+/, "")
    .trim();
  return prompt || text;
};

function Chat({
  messages,
  setMessages,
  chatSaveStatus = "saved",
  onRetryChatSave,
  canInstallApp = false,
  onInstallApp,
  isThinking,
  setIsThinking,
  cancelRequestRef,
}) {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [toolActivity, setToolActivity] = useState(null);
  const [imageGeneration, setImageGeneration] = useState(null);
  const imagePhaseTimersRef = useRef([]);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [chatCopied, setChatCopied] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showSavedResponses, setShowSavedResponses] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const [activeSearchMatch, setActiveSearchMatch] = useState(0);
  const [chatPreferences] = useState(getResponsePreferences);
  const messageSearchRef = useRef(null);
  const wasThinkingRef = useRef(false);
  const responseTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const chatMenuRef = useRef(null);

  useEffect(() => {
    if (!showChatMenu) return undefined;

    const closeMenuOnOutsideClick = (event) => {
      if (!chatMenuRef.current?.contains(event.target)) {
        setShowChatMenu(false);
      }
    };

    const closeMenuOnEscape = (event) => {
      if (event.key === "Escape") setShowChatMenu(false);
    };

    document.addEventListener("pointerdown", closeMenuOnOutsideClick);
    document.addEventListener("keydown", closeMenuOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeMenuOnOutsideClick);
      document.removeEventListener("keydown", closeMenuOnEscape);
    };
  }, [showChatMenu]);

  useEffect(() => {
    const handleChatSearchShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setShowMessageSearch(true);
        window.setTimeout(() => messageSearchRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", handleChatSearchShortcut);
    return () => window.removeEventListener("keydown", handleChatSearchShortcut);
  }, []);

  const getChatTranscript = () => {
    const firstUserMessage = messages.find((message) => message.role === "user");
    const firstUserText = typeof firstUserMessage?.content === "string"
      ? firstUserMessage.content
      : "AI conversation";
    const chatTitle = firstUserText
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    const transcript = [
      `# ${chatTitle || "AI conversation"}`,
      `Exported: ${new Date().toLocaleString()}`,
      "",
      ...messages.flatMap((message) => {
        const role = message.role === "user" ? "You" : "Velora AI";
        const text = typeof message.content === "string" ? message.content.trim() : "";
        const attachments = [
          message.document?.name ? `PDF attached: ${message.document.name}` : "",
          message.image?.name ? `Image attached: ${message.image.name}` : "",
        ].filter(Boolean);
        const body = [text, ...attachments].filter(Boolean).join("\n\n");
        return [`${role}:`, "", body || "(No text)", ""];
      }),
    ].join("\n");
    return { chatTitle, transcript };
  };

  const downloadChatAsText = () => {
    if (!messages.length) return;
    const { chatTitle, transcript } = getChatTranscript();

    const fileName = (chatTitle || "ai-conversation")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "ai-conversation";
    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");

    downloadLink.href = downloadUrl;
    downloadLink.download = `${fileName}.txt`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    setShowChatMenu(false);
  };

  const exportChat = () => {
    if (!messages.length) return;
    const { chatTitle, transcript } = getChatTranscript();
    const markdown = transcript.replace(/^(You|Velora AI):$/gm, "## $1");
    const fileName = (chatTitle || "ai-conversation")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "ai-conversation";
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = `${fileName}.md`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    setShowChatMenu(false);
  };

  const copyConversation = async () => {
    if (!messages.length) return;
    try {
      await navigator.clipboard.writeText(getChatTranscript().transcript);
      setChatCopied(true);
      window.setTimeout(() => setChatCopied(false), 1600);
    } catch (error) {
      console.error("Could not copy conversation:", error);
    }
    setShowChatMenu(false);
  };

  const printConversation = () => {
    setShowChatMenu(false);
    window.setTimeout(() => window.print(), 0);
  };

  const handleMessageFeedback = (index, feedback) => {
    setMessages((previousMessages) => previousMessages.map((message, messageIndex) =>
      messageIndex === index ? { ...message, feedback } : message,
    ));
  };

  const handleToggleSavedResponse = (index) => {
    setMessages((previousMessages) => previousMessages.map((message, messageIndex) =>
      messageIndex === index ? { ...message, saved: !message.saved } : message,
    ));
  };

  const savedResponses = useMemo(() => messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => message.role === "assistant" && message.saved && message.content), [messages]);

  const handleEditUserMessage = (index, editedContent) => {
    if (isThinking || !editedContent.trim()) return;
    const priorMessages = messages.slice(0, index);
    setMessages(priorMessages);
    handleSend(editedContent.trim(), null, null, null, priorMessages);
  };

  const handleGenerateImage = async (prompt) => {
    if (isThinking) throw new Error("Wait for the current response to finish first.");
    const createdAt = new Date().toISOString();
    setMessages((previousMessages) => [
      ...previousMessages,
      { role: "user", content: `Create an image: ${prompt}`, createdAt },
    ]);
    setIsThinking(true);
    setImageGeneration({ prompt, phase: "understanding" });
    imagePhaseTimersRef.current.forEach(window.clearTimeout);
    imagePhaseTimersRef.current = [
      window.setTimeout(() => setImageGeneration((state) => state ? { ...state, phase: "processing" } : null), 1200),
      window.setTimeout(() => setImageGeneration((state) => state ? { ...state, phase: "rendering" } : null), 5200),
    ];
    setToolActivity({ type: "image", label: "Creating your image…", icon: Sparkles });
    try {
      const response = await fetch(apiUrl("/api/images/generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          prompt,
          aspectRatio: getResponsePreferences().imageAspectRatio || "square",
          quality: getResponsePreferences().imageQuality || "standard",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.image) {
        throw new Error(data.message || "Image generation failed. Please try again.");
      }
      const generatedImage = {
        role: "assistant",
        content: "Generated image",
        image: {
          name: `generated-image.${data.mimeType === "image/jpeg" ? "jpg" : data.mimeType === "image/webp" ? "webp" : "png"}`,
          type: data.mimeType || "image/png",
          data: data.image,
        },
        createdAt: new Date().toISOString(),
      };
      setMessages((previousMessages) => [...previousMessages, generatedImage]);
    } catch (error) {
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          role: "assistant",
          content: error.message || "Image generation failed. Please try again.",
          isError: true,
          createdAt: new Date().toISOString(),
        },
      ]);
      throw error;
    } finally {
      imagePhaseTimersRef.current.forEach(window.clearTimeout);
      imagePhaseTimersRef.current = [];
      setImageGeneration(null);
      setIsThinking(false);
      setToolActivity(null);
    }
  };

  const searchMatches = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    if (!query) return [];
    return messages.reduce((matches, message, index) => {
      if (String(message.content || "").toLowerCase().includes(query)) matches.push(index);
      return matches;
    }, []);
  }, [messageSearch, messages]);

  useEffect(() => {
    if (!searchMatches.length) return;
    const messageIndex = searchMatches[activeSearchMatch];
    document.querySelector(`[data-message-index="${messageIndex}"]`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeSearchMatch, searchMatches]);

  const moveSearchMatch = (direction) => {
    if (!searchMatches.length) return;
    setActiveSearchMatch((current) => (current + direction + searchMatches.length) % searchMatches.length);
  };

  const closeMessageSearch = () => {
    setShowMessageSearch(false);
    setMessageSearch("");
  };

  useEffect(() => {
    let isMounted = true;
    let requestController;

    const checkConnection = async () => {
      requestController?.abort();
      requestController = new AbortController();
      const timeoutId = window.setTimeout(() => requestController.abort(), 5000);

      try {
        const response = await fetch(apiUrl("/api/health"), {
          signal: requestController.signal,
          cache: "no-store",
        });
        const health = await response.json();

        if (isMounted) {
          setConnectionStatus(
            response.ok && health.status === "online" ? "online" : "offline",
          );
        }
      } catch {
        if (isMounted) setConnectionStatus("offline");
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    checkConnection();
    const intervalId = window.setInterval(checkConnection, 15000);
    const handleBrowserOnline = () => checkConnection();
    const handleBrowserOffline = () => setConnectionStatus("offline");

    window.addEventListener("online", handleBrowserOnline);
    window.addEventListener("offline", handleBrowserOffline);

    return () => {
      imagePhaseTimersRef.current.forEach(window.clearTimeout);
      isMounted = false;
      requestController?.abort();
      window.clearInterval(intervalId);
      window.removeEventListener("online", handleBrowserOnline);
      window.removeEventListener("offline", handleBrowserOffline);
    };
  }, []);

  // --------------------------------
  // Source Header Decoder
  // --------------------------------

  const decodeSourceHeader = (header) => {
    if (!header) return [];

    try {
      const binaryString = window.atob(header);

      const bytes = Uint8Array.from(binaryString, (char) =>
        char.charCodeAt(0),
      );

      const decodedString = new TextDecoder().decode(bytes);

      return JSON.parse(decodedString);
    } catch (error) {
      console.error("Failed to decode source header:", error);
      return [];
    }
  };

  // --------------------------------
  // Tool Activity Detection
  // --------------------------------

  const detectToolActivity = (message) => {
    if (!message || typeof message !== "string") {
      return {
        type: "working",
        label: "Working...",
        icon: LoaderCircle,
      };
    }

    const text = message.toLowerCase();

    if (
      text.includes("weather") ||
      text.includes("temperature") ||
      text.includes("rain") ||
      text.includes("humidity") ||
      text.includes("forecast")
    ) {
      return {
        type: "weather",
        label: "Checking weather...",
        icon: CloudSun,
      };
    }

    if (
      text.includes("usd") ||
      text.includes("inr") ||
      text.includes("eur") ||
      text.includes("gbp") ||
      text.includes("currency") ||
      text.includes("dollar") ||
      text.includes("rupee") ||
      text.includes("pound") ||
      text.includes("euro") ||
      text.includes("convert money")
    ) {
      return {
        type: "currency",
        label: "Converting currency...",
        icon: Coins,
      };
    }

    if (
      text.includes("calculate") ||
      text.includes("solve") ||
      text.includes("percentage") ||
      text.includes("%") ||
      /[\d]+\s*[*+/-]\s*[\d]+/.test(text)
    ) {
      return {
        type: "calculator",
        label: "Calculating...",
        icon: Calculator,
      };
    }

    if (
      text.includes("document") ||
      text.includes("pdf") ||
      text.includes("uploaded file") ||
      text.includes("uploaded document")
    ) {
      return {
        type: "document",
        label: "Searching documents...",
        icon: FileSearch,
      };
    }

    if (
      text.includes("remember") ||
      text.includes("memory") ||
      text.includes("what do you know about me") ||
      text.includes("what do you remember")
    ) {
      return {
        type: "memory",
        label: "Checking memory...",
        icon: Brain,
      };
    }

    if (
      text.includes("code") ||
      text.includes("javascript") ||
      text.includes("react") ||
      text.includes("node.js") ||
      text.includes("nodejs") ||
      text.includes("debug") ||
      text.includes("syntax")
    ) {
      return {
        type: "developer",
        label: "Processing code...",
        icon: Code2,
      };
    }

    if (
      text.includes("latest") ||
      text.includes("news") ||
      text.includes("today") ||
      text.includes("current") ||
      text.includes("recent") ||
      text.includes("update") ||
      text.includes("release") ||
      text.includes("price") ||
      text.includes("score")
    ) {
      return {
        type: "web",
        label: "Searching the web...",
        icon: Globe,
      };
    }

    return {
      type: "working",
      label: "AI is working...",
      icon: LoaderCircle,
    };
  };

  // --------------------------------
  // Image To Base64
  // --------------------------------

  const imageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve(null);
        return;
      }

      // Already converted image
      if (typeof file === "string") {
        resolve(file);
        return;
      }

      // Stored image object
      if (file?.data && typeof file.data === "string") {
        resolve(file.data);
        return;
      }

      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);

      reader.onerror = () =>
        reject(new Error("Failed to read image"));

      reader.readAsDataURL(file);
    });
  };

  // --------------------------------
  // Tool Activity From Backend
  // --------------------------------

  const getToolActivityFromEvent = (event) => {
    const toolName = event?.tool || event?.name;

    const toolMap = {
      calculate: {
        type: "calculator",
        label: "Calculating...",
        icon: Calculator,
      },

      get_current_date_time: {
        type: "datetime",
        label: "Checking date & time...",
        icon: LoaderCircle,
      },

      convert_unit: {
        type: "unit",
        label: "Converting units...",
        icon: LoaderCircle,
      },

      search_web: {
        type: "web",
        label: "Searching the web...",
        icon: Globe,
      },

      convert_currency: {
        type: "currency",
        label: "Converting currency...",
        icon: Coins,
      },

      get_weather: {
        type: "weather",
        label: "Checking weather...",
        icon: CloudSun,
      },

      developer_tool: {
        type: "developer",
        label: "Processing code...",
        icon: Code2,
      },

      search_documents: {
        type: "document",
        label: "Searching documents...",
        icon: FileSearch,
      },

      search_memory: {
        type: "memory",
        label: "Checking memory...",
        icon: Brain,
      },

      image_analysis: {
        type: "image",
        label: "Analyzing image...",
        icon: Sparkles,
      },
    };

    return (
      toolMap[toolName] || {
        type: "working",
        label: "AI is working...",
        icon: LoaderCircle,
      }
    );
  };

  // --------------------------------
  // Handle NDJSON Stream
  // --------------------------------

  const processStream = async (
    reader,
    decoder,
    controller,
    sources,
    webSources,
    assistantMessageId,
  ) => {
    let buffer = "";
    let aiResponse = "";

    while (true) {
      if (controller.signal.aborted) {
        break;
      }

      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, {
        stream: true,
      });

      const lines = buffer.split("\n");

      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
          continue;
        }

        let event;

        try {
          event = JSON.parse(trimmedLine);
        } catch {
          console.warn(
            "Skipping invalid NDJSON event:",
            trimmedLine,
          );
          continue;
        }

        // --------------------------------
        // Tool Started
        // --------------------------------

        if (event.type === "tool_start") {
          setToolActivity(
            getToolActivityFromEvent(event),
          );

          continue;
        }

        // --------------------------------
        // Tool Finished
        // --------------------------------

        if (event.type === "tool_end") {
          setToolActivity(null);

          continue;
        }

        // --------------------------------
        // Image Analysis
        // --------------------------------

        if (event.type === "image_analysis") {
          if (event.status === "start") {
            setToolActivity({
              type: "image",
              label: "Analyzing image...",
              icon: Sparkles,
            });
          } else {
            setToolActivity(null);
          }

          continue;
        }

        // --------------------------------
        // Sources
        // --------------------------------

        if (event.type === "sources") {
          sources = event.documentSources || sources || [];
          webSources = event.webSources || webSources || [];

          setMessages((prevMessages) => {
            const updatedMessages = [...prevMessages];
            const assistantIndex = updatedMessages.findIndex(
              (message) => message.streamId === assistantMessageId,
            );

            if (assistantIndex < 0) {
              return updatedMessages;
            }

            updatedMessages[assistantIndex] = {
              ...updatedMessages[assistantIndex],
              sources,
              webSources,
            };

            return updatedMessages;
          });

          continue;
        }

        // --------------------------------
        // AI Content
        // --------------------------------

        if (event.type === "content") {
          if (typeof event.content === "string") {
            aiResponse += event.content;

            setMessages((prevMessages) => {
              const updatedMessages = [...prevMessages];
              const assistantIndex = updatedMessages.findIndex(
                (message) => message.streamId === assistantMessageId,
              );

              if (assistantIndex < 0) {
                return updatedMessages;
              }

              updatedMessages[assistantIndex] = {
                ...updatedMessages[assistantIndex],
                role: "assistant",
                content: aiResponse,
                sources,
                webSources,
              };

              return updatedMessages;
            });
          }

          continue;
        }

        // --------------------------------
        // Stream Error
        // --------------------------------

        if (event.type === "error") {
          throw new Error(
            event.message || "AI request failed",
          );
        }

        // --------------------------------
        // Done
        // --------------------------------

        if (event.type === "done") {
          setToolActivity(null);
        }
      }
    }

    // Process any remaining buffered event
    const remaining = buffer.trim();

    if (remaining) {
      try {
        const event = JSON.parse(remaining);

        if (event.type === "content") {
          if (typeof event.content === "string") {
            aiResponse += event.content;

            setMessages((prevMessages) => {
              const updatedMessages = [...prevMessages];
              const assistantIndex = updatedMessages.findIndex(
                (message) => message.streamId === assistantMessageId,
              );

              if (assistantIndex < 0) {
                return updatedMessages;
              }

              updatedMessages[assistantIndex] = {
                ...updatedMessages[assistantIndex],
                role: "assistant",
                content: aiResponse,
                sources,
                webSources,
              };

              return updatedMessages;
            });
          }
        }

        if (event.type === "sources") {
          sources = event.documentSources || sources || [];
          webSources = event.webSources || webSources || [];

          setMessages((prevMessages) => {
            const updatedMessages = [...prevMessages];
            const assistantIndex = updatedMessages.findIndex(
              (message) => message.streamId === assistantMessageId,
            );

            if (assistantIndex < 0) {
              return updatedMessages;
            }

            updatedMessages[assistantIndex] = {
              ...updatedMessages[assistantIndex],
              sources,
              webSources,
            };

            return updatedMessages;
          });
        }
      } catch (error) {
        console.warn(
          "Failed to parse final stream buffer:",
          error,
        );
      }
    }

    return aiResponse;
  };

  // --------------------------------
  // Cancel Request
  // --------------------------------

  const handleCancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setToolActivity(null);
    setIsThinking(false);
  }, [setIsThinking, setToolActivity]);

  useEffect(() => {
    if (cancelRequestRef) {
      cancelRequestRef.current = handleCancelRequest;
    }

    return () => {
      if (cancelRequestRef) {
        cancelRequestRef.current = null;
      }
    };
  }, [cancelRequestRef, handleCancelRequest]);

  // --------------------------------
  // Image Animation
  // --------------------------------

  const animateImageToMessage = (
    animationData,
    imageAnimationId,
  ) => {
    if (
      !animationData?.animateImage ||
      !animationData?.sourceRect ||
      !imageAnimationId
    ) {
      return;
    }

    const sourceRect = animationData.sourceRect;

    const messageElement = document.querySelector(
      `[data-image-animation-id="${imageAnimationId}"]`,
    );

    if (!messageElement) {
      return;
    }

    const targetImage =
      messageElement.querySelector(".message-image");

    if (!targetImage) {
      return;
    }

    messageElement.classList.add(
      "message-image-animation-pending",
    );

    const targetRect =
      targetImage.getBoundingClientRect();

    const imageSource = targetImage.src;

    if (!imageSource) {
      messageElement.classList.remove(
        "message-image-animation-pending",
      );
      return;
    }

    const flyingImage = document.createElement("img");

    flyingImage.src = imageSource;
    flyingImage.className = "flying-image";

    flyingImage.style.left = `${sourceRect.left}px`;
    flyingImage.style.top = `${sourceRect.top}px`;
    flyingImage.style.width = `${sourceRect.width}px`;
    flyingImage.style.height = `${sourceRect.height}px`;
    flyingImage.style.opacity = "1";
    flyingImage.style.transform = "scale(0.96)";

    document.body.appendChild(flyingImage);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flyingImage.style.left = `${targetRect.left}px`;
        flyingImage.style.top = `${targetRect.top}px`;
        flyingImage.style.width = `${targetRect.width}px`;
        flyingImage.style.height = `${targetRect.height}px`;
        flyingImage.style.transform = "scale(1)";
      });
    });

    setTimeout(() => {
      messageElement.classList.remove(
        "message-image-animation-pending",
      );

      flyingImage.style.opacity = "0";

      setTimeout(() => {
        flyingImage.remove();
      }, 180);
    }, 620);
  };

  // --------------------------------
  // Send Message
  // --------------------------------

  const handleSend = async (
    message,
    image = null,
    animationData = null,
    documentData = null,
    historyOverride = null,
  ) => {
    const imagePrompt = !image && !documentData ? getImageGenerationPrompt(message) : null;
    if (imagePrompt) {
      try {
        await handleGenerateImage(imagePrompt);
      } catch {
        // handleGenerateImage adds the prompt and any failure to the conversation.
      }
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }

    setIsThinking(true);

    setToolActivity(
      image
        ? {
            type: "image",
            label: "Analyzing image...",
            icon: Sparkles,
          }
        : detectToolActivity(message),
    );

    const controller = new AbortController();

    abortControllerRef.current = controller;

    try {
      let imageData = null;

      if (image) {
        imageData = await imageToBase64(image);
      }

      const imageAnimationId =
        image && animationData?.animateImage
          ? `image-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`
          : null;

      const userMessage = {
        role: "user",
        content: message || "",
        createdAt: new Date().toISOString(),
        image: imageData
          ? {
              name: image?.name || "image",
              type:
                image?.type ||
                imageData.match(
                  /^data:(.*?);/,
                )?.[1] ||
                "image/*",
              data: imageData,
            }
          : null,
        document: documentData || null,
        imageAnimationId,
      };

      setMessages((prevMessages) => [
        ...prevMessages,
        userMessage,
      ]);

      if (
        imageAnimationId &&
        animationData?.animateImage
      ) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (chatPreferences.autoScroll) {
              messagesEndRef.current?.scrollIntoView({
                behavior: "auto",
                block: "end",
              });
            }

            requestAnimationFrame(() =>
              animateImageToMessage(
                animationData,
                imageAnimationId,
              ),
            );
          });
        });
      }

      // --------------------------------
      // API Request
      // --------------------------------

      const response = await fetch(
        apiUrl("/api/chat"),
        {
          method: "POST",
          signal: controller.signal,

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem(
              "token",
            )}`,
          },

          body: JSON.stringify({
            message,
            image: imageData,
            document: documentData || null,
            history: historyOverride || messages,
            preferences: getResponsePreferences(),
          }),
        },
      );

      if (!response.ok || !response.body) {
        throw new Error("AI request failed");
      }

      // --------------------------------
      // Initial Source Headers
      // --------------------------------

      const sourceHeader =
        response.headers.get("X-Document-Sources");

      const webSourceHeader =
        response.headers.get("X-Web-Sources");

      let sources = decodeSourceHeader(sourceHeader);

      let webSources =
        decodeSourceHeader(webSourceHeader);

      // --------------------------------
      // Add Empty Assistant Message
      // --------------------------------

      const assistantMessageId =
        globalThis.crypto?.randomUUID?.() ||
        `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      setMessages((prevMessages) => {
        return [
          ...prevMessages,
          {
            streamId: assistantMessageId,
            role: "assistant",
            content: "",
            createdAt: new Date().toISOString(),
            sources,
            webSources,
          },
        ];
      });

      // --------------------------------
      // Read NDJSON Stream
      // --------------------------------

      const reader = response.body.getReader();

      const decoder = new TextDecoder();

      setToolActivity(null);

      await processStream(
        reader,
        decoder,
        controller,
        sources,
        webSources,
        assistantMessageId,
      );
    } catch (error) {
      if (error.name === "AbortError") {
        setToolActivity(null);
        return;
      }

      console.error("AI Error:", error);

      setToolActivity(null);

      setMessages((prevMessages) => [
        ...prevMessages,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't connect to the AI. Please try again.",
          isError: true,
          retryMessage: message,
        },
      ]);
    } finally {
      setIsThinking(false);
      setToolActivity(null);

      if (
        abortControllerRef.current === controller
      ) {
        abortControllerRef.current = null;
      }
    }
  };

  // --------------------------------
  // Retry
  // --------------------------------

  const handleRetry = (message) => {
    if (isThinking) return;

    setMessages((prevMessages) => {
      const updatedMessages = [...prevMessages];

      updatedMessages.pop();

      return updatedMessages;
    });

    handleSend(message);
  };

  // --------------------------------
  // Regenerate
  // --------------------------------

  const handleRegenerate = async (
    content,
    index,
  ) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();

    abortControllerRef.current = controller;

    setIsThinking(true);

    setToolActivity(
      detectToolActivity(content),
    );

    try {
      const history = messages
        .slice(0, index)
        .filter((item) => !item.isError)
        .slice(-20);

      const response = await fetch(
        apiUrl("/api/chat"),
        {
          method: "POST",
          signal: controller.signal,

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem(
              "token",
            )}`,
          },

          body: JSON.stringify({
            message:
              history[history.length - 1]?.content ||
              content,
            history,
            preferences: getResponsePreferences(),
          }),
        },
      );

      if (!response.ok || !response.body) {
        throw new Error("AI request failed");
      }

      const sourceHeader =
        response.headers.get("X-Document-Sources");

      const webSourceHeader =
        response.headers.get("X-Web-Sources");

      let sources =
        decodeSourceHeader(sourceHeader);

      let webSources =
        decodeSourceHeader(webSourceHeader);

      const reader =
        response.body.getReader();

      const decoder = new TextDecoder();

      let buffer = "";
      let aiResponse = "";

      setToolActivity(null);

      while (true) {
        const { done, value } =
          await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines = buffer.split("\n");

        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();

          if (!trimmedLine) continue;

          let event;

          try {
            event = JSON.parse(trimmedLine);
          } catch {
            continue;
          }

          if (event.type === "tool_start") {
            setToolActivity(
              getToolActivityFromEvent(event),
            );

            continue;
          }

          if (event.type === "tool_end") {
            setToolActivity(null);

            continue;
          }

          if (event.type === "image_analysis") {
            if (event.status === "start") {
              setToolActivity({
                type: "image",
                label: "Analyzing image...",
                icon: Sparkles,
              });
            } else {
              setToolActivity(null);
            }

            continue;
          }

          if (event.type === "sources") {
            sources = event.documentSources || sources || [];
            webSources = event.webSources || webSources || [];

            setMessages((prevMessages) => {
              const updatedMessages = [
                ...prevMessages,
              ];

              if (!updatedMessages[index]) {
                return updatedMessages;
              }

              updatedMessages[index] = {
                  ...updatedMessages[index],
                  sources,
                  webSources,
              };

              return updatedMessages;
            });

            continue;
          }

          if (event.type === "content") {
            if (
              typeof event.content ===
              "string"
            ) {
              aiResponse += event.content;

              setMessages((prevMessages) => {
                const updatedMessages = [
                  ...prevMessages,
                ];

                if (!updatedMessages[index]) {
                  return updatedMessages;
                }

                updatedMessages[index] = {
                  ...updatedMessages[index],
                  role: "assistant",
                  content: aiResponse,
                  sources,
                  webSources,
                };

                return updatedMessages;
              });
            }

            continue;
          }

          if (event.type === "error") {
            throw new Error(
              event.message ||
                "Regeneration failed",
            );
          }

          if (event.type === "done") {
            setToolActivity(null);
          }
        }
      }

      if (buffer.trim()) {
        try {
          const event = JSON.parse(
            buffer.trim(),
          );

          if (event.type === "content") {
            if (
              typeof event.content ===
              "string"
            ) {
              aiResponse += event.content;

              setMessages((prevMessages) => {
                const updatedMessages = [
                  ...prevMessages,
                ];

                if (!updatedMessages[index]) {
                  return updatedMessages;
                }

                updatedMessages[index] = {
                  ...updatedMessages[index],
                  role: "assistant",
                  content: aiResponse,
                  sources,
                  webSources,
                };

                return updatedMessages;
              });
            }
          }
        } catch {
          // Ignore incomplete final buffer
        }
      }
    } catch (error) {
      if (error.name === "AbortError") {
        setToolActivity(null);
        return;
      }

      console.error(
        "Regenerate Error:",
        error,
      );

      setToolActivity(null);

      setMessages((prevMessages) => {
        const updatedMessages = [
          ...prevMessages,
        ];

        updatedMessages[index] = {
          ...updatedMessages[index],
          role: "assistant",
          content:
            "Sorry, something went wrong while regenerating the response.",
        };

        return updatedMessages;
      });
    } finally {
      setIsThinking(false);

      setToolActivity(null);

      if (
        abortControllerRef.current ===
        controller
      ) {
        abortControllerRef.current = null;
      }
    }
  };

  // --------------------------------
  // Auto Scroll
  // --------------------------------

  useEffect(() => {
    if (!chatPreferences.autoScroll) return;
    messagesEndRef.current?.scrollIntoView({
      behavior: chatPreferences.reduceMotion ? "auto" : "smooth",
    });
  }, [messages, isThinking, chatPreferences.autoScroll, chatPreferences.reduceMotion]);

  useEffect(() => {
    if (wasThinkingRef.current && !isThinking && document.hidden) {
      const preferences = getResponsePreferences();
      if (preferences.notifications && "Notification" in window && Notification.permission === "granted") {
        new Notification("Velora AI", { body: "Your response is ready." });
      }
    }
    wasThinkingRef.current = isThinking;
  }, [isThinking]);

  // --------------------------------
  // Cleanup
  // --------------------------------

  useEffect(() => {
    return () => {
      if (responseTimeoutRef.current) {
        clearTimeout(
          responseTimeoutRef.current,
        );
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // --------------------------------
  // Tool Icon
  // --------------------------------

  const ToolIcon =
    toolActivity?.icon || LoaderCircle;

  const hasPendingAssistant =
    isThinking &&
    messages.at(-1)?.role === "assistant" &&
    !messages.at(-1)?.content;

  // --------------------------------
  // UI
  // --------------------------------

  return (
    <main className="chat">
      <NeuralBackdrop active={isThinking} />
      <header className="chat-header">
        <div className="chat-title">
          <img className="chat-brand-mark" src="/pwa-icon.svg" alt="" />
          <h2>Velora AI</h2>

          <span
            className={`ai-status ${connectionStatus}`}
            role="status"
            aria-live="polite"
          >
            <span className="status-dot"></span>
            {connectionStatus === "online"
              ? "Online"
              : connectionStatus === "offline"
                ? "Offline"
                : "Connecting"}
          </span>
          {messages.length > 0 && (
            chatSaveStatus === "error" ? (
              <button
                type="button"
                className="chat-save-status error chat-save-retry"
                onClick={onRetryChatSave}
                title="Retry saving this conversation"
              >
                Not saved · Retry
              </button>
            ) : (
              <span className={`chat-save-status ${chatSaveStatus}`} role="status" aria-live="polite">
                {chatSaveStatus === "saving" ? "Saving…" : "Saved"}
              </span>
            )
          )}
        </div>

        {canInstallApp && (
          <button className="chat-menu-btn chat-install-btn" type="button" onClick={onInstallApp} title="Install Velora AI" aria-label="Install Velora AI">
            <Download size={17} />
          </button>
        )}

        <button className="chat-menu-btn" type="button" onClick={() => { setShowShortcutsHelp((open) => !open); setShowSavedResponses(false); }} title="Keyboard shortcuts" aria-label="Keyboard shortcuts" aria-expanded={showShortcutsHelp}>
          <Keyboard size={17} />
        </button>
        <button className={`chat-menu-btn saved-responses-toggle ${showSavedResponses ? "active" : ""}`} type="button" onClick={() => { setShowSavedResponses((open) => !open); setShowShortcutsHelp(false); }} title="Saved responses" aria-label={`Saved responses (${savedResponses.length})`} aria-expanded={showSavedResponses}>
          <Bookmark size={17} />
          {savedResponses.length > 0 && <span>{savedResponses.length}</span>}
        </button>

        <div className={`chat-message-search${showMessageSearch ? " is-open" : ""}`}>
          {showMessageSearch ? (
            <>
              <input
                ref={messageSearchRef}
                type="search"
                value={messageSearch}
                onChange={(event) => {
                  setMessageSearch(event.target.value);
                  setActiveSearchMatch(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    moveSearchMatch(event.shiftKey ? -1 : 1);
                  }
                  if (event.key === "Escape") closeMessageSearch();
                }}
                placeholder="Search this chat"
                aria-label="Search messages in this chat"
              />
              {messageSearch.trim() && (
                <span className="chat-search-count" aria-live="polite">
                  {searchMatches.length ? `${activeSearchMatch + 1}/${searchMatches.length}` : "0 results"}
                </span>
              )}
              <button type="button" className="chat-menu-btn" onClick={() => moveSearchMatch(-1)} disabled={!searchMatches.length} aria-label="Previous match" title="Previous match">
                <ChevronUp size={17} />
              </button>
              <button type="button" className="chat-menu-btn" onClick={() => moveSearchMatch(1)} disabled={!searchMatches.length} aria-label="Next match" title="Next match">
                <ChevronDown size={17} />
              </button>
              <button type="button" className="chat-menu-btn" onClick={closeMessageSearch} aria-label="Close message search" title="Close search">
                <X size={17} />
              </button>
            </>
          ) : (
            <button
              className="chat-menu-btn"
              type="button"
              aria-label="Search this chat"
              title="Search this chat"
              disabled={!messages.length}
              onClick={() => {
                setShowMessageSearch(true);
                window.setTimeout(() => messageSearchRef.current?.focus(), 0);
              }}
            >
              <Search size={18} />
            </button>
          )}
        </div>

        <div className="chat-menu-container" ref={chatMenuRef}>
          <button
            className="chat-menu-btn"
            type="button"
            aria-label="Chat options"
            aria-haspopup="menu"
            aria-expanded={showChatMenu}
            disabled={messages.length === 0}
            onClick={() => setShowChatMenu((isOpen) => !isOpen)}
          >
            <MoreVertical size={19} />
          </button>
          {showChatMenu && (
            <div className="chat-menu-popover" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={exportChat}
              >
                <Download size={15} />
                <span>Export as Markdown</span>
              </button>
              <button type="button" role="menuitem" onClick={downloadChatAsText}>
                <FileText size={15} />
                <span>Download as TXT</span>
              </button>
              <button type="button" role="menuitem" onClick={copyConversation}>
                <Copy size={15} />
                <span>{chatCopied ? "Copied conversation" : "Copy conversation"}</span>
              </button>
              <button type="button" role="menuitem" onClick={printConversation}>
                <Printer size={15} />
                <span>Print / Save as PDF</span>
              </button>
            </div>
          )}
        </div>
        {chatCopied && <span className="chat-copy-feedback" role="status">Conversation copied</span>}
      </header>

      {showShortcutsHelp && (
        <aside className="shortcuts-help-panel" aria-label="Keyboard shortcuts">
          <div className="shortcuts-help-heading"><strong>Keyboard shortcuts</strong><button type="button" onClick={() => setShowShortcutsHelp(false)} aria-label="Close shortcuts"><X size={15} /></button></div>
          <div><span>Send message</span><kbd>Enter</kbd></div>
          <div><span>New line</span><kbd>Shift + Enter</kbd></div>
          <div><span>Focus message box</span><kbd>Ctrl / ⌘ + Shift + L</kbd></div>
          <div><span>Find in chat</span><kbd>Ctrl / ⌘ + F</kbd></div>
        </aside>
      )}

      {showSavedResponses && (
        <aside className="saved-responses-panel" aria-label="Saved responses in this conversation">
          <div className="saved-responses-heading">
            <strong>Saved responses</strong>
            <button type="button" onClick={() => setShowSavedResponses(false)} aria-label="Close saved responses"><X size={15} /></button>
          </div>
          {savedResponses.length === 0 ? (
            <p className="saved-responses-empty">Save an assistant answer with the bookmark icon to find it here.</p>
          ) : savedResponses.map(({ message, index }) => (
            <button className="saved-response-item" type="button" key={`${index}-${message.createdAt || "saved"}`} onClick={() => {
              setShowSavedResponses(false);
              document.querySelector(`[data-message-index="${index}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}>
              <span>{message.content}</span>
              {message.createdAt && <time>{new Date(message.createdAt).toLocaleString()}</time>}
            </button>
          ))}
        </aside>
      )}

      {messages.length === 0 && (
        <div className="welcome-screen">
          <div className="welcome-icon">
            <Sparkles size={28} />
          </div>

          <h1>How can I help you today?</h1>

          <p>
            Ask anything and start a
            conversation.
          </p>

          <div className="suggestion-list">
            <button
              className="suggestion-btn"
              onClick={() =>
                handleSend(
                  "Explain React in simple words",
                )
              }
            >
              Explain React in simple words
            </button>

            <button
              className="suggestion-btn"
              onClick={() =>
                handleSend(
                  "Help me write JavaScript code",
                )
              }
            >
              Help me write JavaScript code
            </button>

            <button
              className="suggestion-btn"
              onClick={() =>
                handleSend(
                  "Give me some project ideas",
                )
              }
            >
              Give me some project ideas
            </button>
          </div>
        </div>
      )}

      <div
        className="messages"
        ref={messagesContainerRef}
        onScroll={() => {
          const container =
            messagesContainerRef.current;

          if (!container) return;

          const distanceFromBottom =
            container.scrollHeight -
            container.scrollTop -
            container.clientHeight;

          setShowScrollButton(
            distanceFromBottom > 120,
          );
        }}
      >
        {messages.map(
          (message, index) => (
            <Suspense key={index} fallback={null}>
              <Message
                role={message.role}
                content={message.content}
                onRegenerate={handleRegenerate}
                index={index}
                onRetry={handleRetry}
                isError={message.isError}
                retryMessage={message.retryMessage}
                isThinking={isThinking}
                isActiveResponse={
                  isThinking &&
                  index === messages.length - 1 &&
                  message.role === "assistant"
                }
                toolActivity={toolActivity}
                sources={message.sources}
                webSources={message.webSources}
                image={message.image}
                document={message.document}
                imageAnimationId={message.imageAnimationId}
                searchMatch={searchMatches.includes(index)}
                activeSearchMatch={searchMatches[activeSearchMatch] === index && Boolean(messageSearch.trim())}
                feedback={message.feedback}
                onFeedback={(feedback) => handleMessageFeedback(index, feedback)}
                onEdit={handleEditUserMessage}
                saved={message.saved}
                onSave={() => handleToggleSavedResponse(index)}
                createdAt={message.createdAt}
              />
            </Suspense>
          ),
        )}

        {imageGeneration && (
          <ImageCreationCanvas
            prompt={imageGeneration.prompt}
            phase={imageGeneration.phase}
          />
        )}

        {showScrollButton && (
          <button
            type="button"
            className="scroll-bottom-btn"
            onClick={() =>
              messagesEndRef.current?.scrollIntoView(
                {
                  behavior: "smooth",
                },
              )
            }
          >
            ↓
          </button>
        )}

        {isThinking && !hasPendingAssistant && (
          <div className="tool-activity">
            <div className="tool-activity-icon">
              <ToolIcon size={16} />
            </div>

            <span>
              {toolActivity?.label ||
                "AI is thinking..."}
            </span>

            <span className="tool-activity-dots">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <InputBox
        onSend={handleSend}
        onGenerateImage={handleGenerateImage}
        isThinking={isThinking}
        onStop={handleCancelRequest}
        sendOnEnter={chatPreferences.sendOnEnter !== false}
      />
    </main>
  );
}

export default Chat;
