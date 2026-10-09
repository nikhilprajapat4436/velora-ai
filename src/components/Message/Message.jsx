import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import json from "highlight.js/lib/languages/json";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import yaml from "highlight.js/lib/languages/yaml";
import {
  Check,
  Copy,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Maximize2,
  X,
  RotateCcw,
  FileText,
  Globe,
  ExternalLink,
  Download,
  Volume2,
  VolumeX,
  Pencil,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import "./Message.css";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("json", json);
hljs.registerLanguage("css", css);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("java", java);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("yaml", yaml);

const languageAliases = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  html: "xml",
  sh: "bash",
  shell: "bash",
  yml: "yaml",
  c: "cpp",
  h: "cpp",
  cc: "cpp",
  "c++": "cpp",
};

function renderContent(content) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({
          inline,
          className,
          children,
          ...props
        }) {
          const match =
            /language-(\w+)/.exec(
              className || "",
            );

          const code = String(children).replace(
            /\n$/,
            "",
          );
          const requestedLanguage = match?.[1]?.toLowerCase();
          const language =
            languageAliases[requestedLanguage] || requestedLanguage;
          const highlightedCode =
            language && hljs.getLanguage(language)
              ? hljs.highlight(code, { language }).value
              : null;

          if (!inline) {
            return (
              <div className="code-wrapper">
                <span className="code-language">
                  {match
                    ? match[1]
                    : "code"}
                </span>

                <button
                  type="button"
                  className="code-copy-btn"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      code,
                    )
                  }
                >
                  <Copy size={14} />
                  Copy
                </button>

                <pre className="code-block">
                  {highlightedCode ? (
                    <code
                      {...props}
                      className={`hljs ${className || ""}`.trim()}
                      dangerouslySetInnerHTML={{
                        __html: highlightedCode,
                      }}
                    />
                  ) : (
                    <code {...props}>{code}</code>
                  )}
                </pre>
              </div>
            );
          }

          return (
            <code
              className="inline-code"
              {...props}
            >
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function Message({
  role,
  content,
  onRegenerate,
  index,
  onRetry,
  isError,
  retryMessage,
  isThinking,
  isActiveResponse = false,
  toolActivity = null,
  sources = [],
  webSources = [],
  image = null,
  document = null,
  imageAnimationId = null,
  feedback = null,
  onFeedback,
  onEdit,
  saved = false,
  onSave,
  createdAt,
  searchMatch = false,
  activeSearchMatch = false,
}) {
  const [copied, setCopied] =
    useState(false);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechUtteranceRef = useRef(null);

  const [isExpanded, setIsExpanded] =
    useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(content);

  const [displayedContent, setDisplayedContent] =
    useState(content);
  const messageDate = createdAt ? new Date(createdAt) : null;
  const hasValidTimestamp = messageDate && !Number.isNaN(messageDate.getTime());

  useEffect(() => {
    if (
      role !== "assistant" ||
      content === "AI is thinking..."
    ) {
      return;
    }

    if (
      content.length <=
      displayedContent.length
    ) {
      return;
    }

    const difference =
      content.length -
      displayedContent.length;

    const charactersToAdd =
      difference > 20
        ? 5
        : difference > 10
          ? 3
          : 2;

    const nextText = content.slice(
      0,
      displayedContent.length +
        charactersToAdd,
    );

    const timer = setTimeout(
      () =>
        setDisplayedContent(
          nextText,
        ),
      15,
    );

    return () => clearTimeout(timer);
  }, [
    content,
    role,
    displayedContent,
  ]);

  const isLongUserMessage =
    role === "user" &&
    content.length > 220;

  const hasImage = Boolean(image?.data);

  const hasDocument =
    role === "user" &&
    document?.name;

  const ActivityIcon = toolActivity?.icon;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = `assistant-response-${index + 1}.md`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  };

  const handleReadAloud = () => {
    if (!("speechSynthesis" in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      speechUtteranceRef.current = null;
      setIsSpeaking(false);
      return;
    }

    const spokenText = content
      .replace(/```[\s\S]*?```/g, " code block omitted. ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!?\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/[>*_~]/g, "")
      .replace(/\n{2,}/g, ". ")
      .trim();

    if (!spokenText) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenText);
    speechUtteranceRef.current = utterance;
    utterance.onend = () => {
      if (speechUtteranceRef.current === utterance) {
        speechUtteranceRef.current = null;
        setIsSpeaking(false);
      }
    };
    utterance.onerror = () => {
      if (speechUtteranceRef.current === utterance) {
        speechUtteranceRef.current = null;
        setIsSpeaking(false);
      }
    };
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => () => {
    if (speechUtteranceRef.current) {
      window.speechSynthesis?.cancel();
      speechUtteranceRef.current = null;
    }
  }, []);

  return (
    <>
      <div
        className={`message message-${role} ${role === "assistant" && image ? "message-generated-image" : ""} ${searchMatch ? "message-search-match" : ""} ${activeSearchMatch ? "message-search-active" : ""}`}
        data-message-index={index}
        data-image-animation-id={
          imageAnimationId ||
          undefined
        }
      >
        <div className="message-content">
          {!isActiveResponse && (
            <div className="message-role">
              {role}
              {hasValidTimestamp && <time className="message-timestamp" dateTime={messageDate.toISOString()}>{messageDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>}
            </div>
          )}

          {/* =========================
              PDF DOCUMENT
          ========================= */}

          {hasDocument && (
            <div className="message-document">
              <div className="message-document-icon">
                <FileText size={22} />
              </div>

              <div className="message-document-info">
                <span
                  className="message-document-name"
                  title={document.name}
                >
                  {document.name}
                </span>

                <span className="message-document-type">
                  PDF Document
                </span>
              </div>
            </div>
          )}

          {/* =========================
              MESSAGE IMAGE
          ========================= */}

          {hasImage && (
            <div className="message-image-wrapper">
              {role === "assistant" && <span className="generated-image-label">Generated</span>}
              <img
                src={image.data}
                alt={image.name || (role === "assistant" ? "Generated image" : "Uploaded image")}
                className={`message-image ${role === "assistant" ? "generated-image-reveal" : ""}`}
                onClick={() =>
                  setIsExpanded(true)
                }
              />
            </div>
          )}

          {/* =========================
              MESSAGE CONTENT
          ========================= */}

          {isActiveResponse && (
            <div className="tool-activity message-tool-activity" aria-live="polite">
              <div className="tool-activity-icon">
                {ActivityIcon ? (
                  <ActivityIcon size={16} />
                ) : null}
              </div>

              <span>
                {toolActivity?.label || "AI is thinking..."}
              </span>

              <span className="tool-activity-dots">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          )}

          {isEditing ? null : content === "AI is thinking..." ? (
            <div className="thinking-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          ) : role === "user" &&
            isLongUserMessage ? (
            <div className="long-user-message">
              <div className="long-user-text">
                {content}
              </div>

              <button
                type="button"
                className="see-more-message-btn"
                onClick={() =>
                  setIsExpanded(true)
                }
              >
                <Maximize2 size={13} />
                See more
              </button>
            </div>
          ) : (
            content &&
            renderContent(
              role === "assistant"
                ? displayedContent
                : content,
            )
          )}

          {role === "user" && isEditing ? (
            <div className="user-message-edit">
              <textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} aria-label="Edit your message" autoFocus />
              <div>
                <button type="button" onClick={() => { setEditDraft(content); setIsEditing(false); }}>Cancel</button>
                <button type="button" className="user-message-edit-save" disabled={!editDraft.trim() || isThinking} onClick={() => { onEdit?.(index, editDraft); setIsEditing(false); }}>Save and resend</button>
              </div>
            </div>
          ) : role === "user" && Boolean(content) && !image && !document && !isError ? (
            <div className="message-actions user-message-actions">
              <button type="button" className="message-action-btn" onClick={handleCopy} title={copied ? "Copied" : "Copy message"} aria-label="Copy message">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
              <button type="button" className="message-action-btn" onClick={() => { setEditDraft(content); setIsEditing(true); }} disabled={isThinking} title="Edit and resend message" aria-label="Edit and resend message">
                <Pencil size={14} />
              </button>
            </div>
          ) : null}

          {/* =========================
              DOCUMENT SOURCES
          ========================= */}

          {role === "assistant" &&
            sources.length > 0 &&
            content !==
              "AI is thinking..." &&
            !isError && (
              <div className="message-sources">
                <div className="message-sources-title">
                  <FileText size={14} />
                  <span>Sources</span>
                </div>

                <div className="message-sources-list">
                  {sources.map(
                    (
                      source,
                      sourceIndex,
                    ) => (
                      <div
                        className="message-source"
                        key={`${source.name}-${sourceIndex}`}
                      >
                        <FileText
                          size={13}
                        />

                        <span
                          title={
                            source.name
                          }
                        >
                          {source.name}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

          {/* =========================
              WEB SOURCES
          ========================= */}

          {role === "assistant" &&
            Array.isArray(
              webSources,
            ) &&
            webSources.length > 0 &&
            content !==
              "AI is thinking..." &&
            !isError && (
              <div className="message-sources message-web-sources">
                <div className="message-sources-title">
                  <Globe size={14} />
                  <span>
                    Web Sources
                  </span>

                  <span className="web-source-count">
                    {
                      webSources.length
                    }
                  </span>
                </div>

                <div className="message-web-sources-list">
                  {webSources.map(
                    (
                      source,
                      sourceIndex,
                    ) => {
                      const sourceUrl =
                        typeof source?.url ===
                        "string"
                          ? source.url.trim()
                          : "";

                      const hostname = (() => {
                        try {
                          return sourceUrl
                            ? new URL(sourceUrl).hostname.replace(
                                /^www\./,
                                "",
                              )
                            : "Web";
                        } catch {
                          return sourceUrl || "Web";
                        }
                      })();

                      const faviconUrl =
                        sourceUrl
                          ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
                              sourceUrl,
                            )}&sz=64`
                          : "";

                      return (
                        <a
                          className="message-web-source-card"
                          key={`${sourceUrl}-${sourceIndex}`}
                          href={
                            sourceUrl ||
                            "#"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          title={
                            source.title ||
                            sourceUrl ||
                            "Web Source"
                          }
                          onClick={(
                            event,
                          ) => {
                            if (
                              !sourceUrl
                            ) {
                              event.preventDefault();
                            }
                          }}
                        >
                          <div className="message-web-source-logo">
                            {faviconUrl && (
                              <img
                                src={
                                  faviconUrl
                                }
                                alt=""
                                onError={(
                                  event,
                                ) => {
                                  event.currentTarget.style.display =
                                    "none";

                                  const fallback =
                                    event
                                      .currentTarget
                                      .nextElementSibling;

                                  if (
                                    fallback
                                  ) {
                                    fallback.style.display =
                                      "flex";
                                  }
                                }}
                              />
                            )}

                            <Globe
                              size={
                                15
                              }
                              className="message-web-source-fallback"
                              style={{
                                display:
                                  faviconUrl
                                    ? "none"
                                    : "flex",
                              }}
                            />
                          </div>

                          <div className="message-web-source-info">
                            <span className="message-web-source-title">
                              {source.title ||
                                hostname ||
                                "Web Source"}
                            </span>

                            <span className="message-web-source-domain">
                              {hostname}
                            </span>
                          </div>

                          <ExternalLink
                            size={13}
                            className="message-web-source-external"
                          />
                        </a>
                      );
                    },
                  )}
                </div>
              </div>
            )}

          {/* =========================
              ERROR
          ========================= */}

          {role === "assistant" &&
            isError && (
              <div className="message-error-label">
                AI response failed
              </div>
            )}

          {role === "assistant" &&
            isError &&
            retryMessage && (
              <button
                type="button"
                className="retry-message-btn"
                onClick={() =>
                  onRetry(
                    retryMessage,
                  )
                }
                disabled={isThinking}
              >
                <RotateCcw size={14} />

                {isThinking
                  ? "Retrying..."
                  : "Retry"}
              </button>
            )}

          {/* =========================
              ACTIONS
          ========================= */}

          {role === "assistant" &&
            Boolean(content) &&
            !isActiveResponse &&
            content !==
              "AI is thinking..." &&
            !isError && (
              <div className="message-actions">
                <button
                  type="button"
                  className={`message-action-btn ${saved ? "active" : ""}`}
                  onClick={onSave}
                  title={saved ? "Remove saved response" : "Save response"}
                  aria-label={saved ? "Remove saved response" : "Save response"}
                  aria-pressed={saved}
                >
                  {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                </button>
                {"speechSynthesis" in window && (
                  <button
                    type="button"
                    className={`message-action-btn ${isSpeaking ? "active" : ""}`}
                    onClick={handleReadAloud}
                    title={isSpeaking ? "Stop reading" : "Read aloud"}
                    aria-label={isSpeaking ? "Stop reading response aloud" : "Read response aloud"}
                    aria-pressed={isSpeaking}
                  >
                    {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                )}
                <button
                  type="button"
                  className="message-action-btn"
                  onClick={handleCopy}
                  title={
                    copied
                      ? "Copied"
                      : "Copy"
                  }
                >
                  {copied ? (
                    <Check size={14} />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>

                <button
                  type="button"
                  className="message-action-btn"
                  onClick={handleDownload}
                  title="Download as Markdown"
                  aria-label="Download response as Markdown"
                >
                  <Download size={14} />
                </button>

                <button
                  type="button"
                  className="message-action-btn"
                  title="Regenerate"
                  onClick={() =>
                    onRegenerate(
                      content,
                      index,
                    )
                  }
                >
                  <RefreshCw
                    size={14}
                  />
                </button>

                <button
                  type="button"
                  className={`message-action-btn ${
                    feedback === "up"
                      ? "active"
                      : ""
                  }`}
                  title="Good response"
                  onClick={() => onFeedback?.(feedback === "up" ? null : "up")}
                >
                  <ThumbsUp
                    size={14}
                  />
                </button>

                <button
                  type="button"
                  className={`message-action-btn ${
                    feedback ===
                    "down"
                      ? "active"
                      : ""
                  }`}
                  title="Bad response"
                  onClick={() => onFeedback?.(feedback === "down" ? null : "down")}
                >
                  <ThumbsDown
                    size={14}
                  />
                </button>
              </div>
            )}
        </div>
      </div>

      {/* =========================
          EXPANDED MODAL
      ========================= */}

      {isExpanded && (
        <div
          className="message-expand-overlay"
          onClick={() =>
            setIsExpanded(false)
          }
        >
          <div
            className="message-expand-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="message-expand-header">
              <div>
                <h3>
                  {hasImage
                    ? "Uploaded Image"
                    : "Your Message"}
                </h3>

                <span>
                  {hasImage
                    ? image.name
                    : `${content.length} characters`}
                </span>
              </div>

              <button
                type="button"
                className="message-expand-close"
                onClick={() =>
                  setIsExpanded(
                    false,
                  )
                }
              >
                <X size={20} />
              </button>
            </div>

            {hasImage ? (
              <div className="message-expand-image">
                <img
                  src={image.data}
                  alt={
                    image.name ||
                    "Uploaded image"
                  }
                />
              </div>
            ) : (
              <div className="message-expand-content">
                {content}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default Message;
