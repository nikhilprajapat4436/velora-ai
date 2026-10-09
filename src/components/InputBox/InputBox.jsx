import { useEffect, useState, useRef } from "react";
import {
  Send,
  Square,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Mic,
  MicOff,
  Sparkles,
  Plus,
  ImagePlus,
  LoaderCircle,
} from "lucide-react";
import "./InputBox.css";
import { apiUrl } from "../../api";

const builtInPromptTemplates = [
  { id: "email", title: "Draft an email", prompt: "Write a clear, professional email about [topic]. Ask me any questions you need first." },
  { id: "explain", title: "Explain simply", prompt: "Explain [topic] in simple terms and include a practical example." },
  { id: "debug", title: "Debug code", prompt: "Help me debug this code. Explain the issue and suggest a fix:\n\n[paste code]" },
  { id: "summary", title: "Summarize text", prompt: "Summarize the following text in concise key points:\n\n[paste text]" },
];

const loadCustomTemplates = () => {
  try {
    const templates = JSON.parse(localStorage.getItem("ai-assistant-prompt-templates") || "[]");
    return Array.isArray(templates) ? templates.filter((template) => template?.title && template?.prompt) : [];
  } catch {
    return [];
  }
};

function InputBox({ onSend, onGenerateImage, isThinking, onStop, sendOnEnter = true }) {
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [customTemplates, setCustomTemplates] = useState(loadCustomTemplates);
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templatePrompt, setTemplatePrompt] = useState("");
  const [showImageGenerator, setShowImageGenerator] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageGenerationError, setImageGenerationError] = useState("");

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const selectedImageRef = useRef(null);
  const recognitionRef = useRef(null);
  const SpeechRecognitionApi = typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

  useEffect(() => () => recognitionRef.current?.stop(), []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [message]);

  const selectPromptTemplate = (prompt) => {
    setMessage(prompt);
    setShowTemplates(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const savePromptTemplate = (event) => {
    event.preventDefault();
    const nextTemplates = [...customTemplates, {
      id: `custom-${Date.now()}`,
      title: templateTitle.trim(),
      prompt: templatePrompt.trim(),
    }];
    try {
      localStorage.setItem("ai-assistant-prompt-templates", JSON.stringify(nextTemplates));
      setCustomTemplates(nextTemplates);
      setTemplateTitle("");
      setTemplatePrompt("");
      setIsAddingTemplate(false);
    } catch {
      setUploadError("Could not save this prompt template in browser storage.");
    }
  };

  const deletePromptTemplate = (templateId) => {
    const nextTemplates = customTemplates.filter((template) => template.id !== templateId);
    try {
      localStorage.setItem("ai-assistant-prompt-templates", JSON.stringify(nextTemplates));
      setCustomTemplates(nextTemplates);
    } catch {
      setUploadError("Could not update saved prompt templates.");
    }
  };

  const submitImageGeneration = async (event) => {
    event.preventDefault();
    const prompt = imagePrompt.trim();
    if (!prompt || !onGenerateImage || isGeneratingImage) return;
    setImageGenerationError("");
    setIsGeneratingImage(true);
    try {
      await onGenerateImage(prompt);
      setImagePrompt("");
      setShowImageGenerator(false);
    } catch (error) {
      setImageGenerationError(error.message || "Image generation failed. Please try again.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const toggleVoiceInput = () => {
    if (!SpeechRecognitionApi) return;
    setVoiceError("");
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionApi();
    recognition.lang = navigator.language || "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((result) => result.isFinal)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();
      if (transcript) {
        setMessage((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${transcript}`);
      }
    };
    recognition.onerror = (event) => {
      setVoiceError(event.error === "not-allowed" ? "Allow microphone access to use voice input." : "Voice input could not start. Try again.");
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setVoiceError("Voice input could not start. Try again.");
      setIsListening(false);
    }
  };

  useEffect(() => {
    const focusComposer = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        textareaRef.current?.focus();
      }
    };

    window.addEventListener("keydown", focusComposer);
    return () => window.removeEventListener("keydown", focusComposer);
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140,
      )}px`;
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setUploadError("");

    if (file.type.startsWith("image/")) {
      if (file.size > 10 * 1024 * 1024) {
        setUploadError("Image must be smaller than 10 MB.");
        e.target.value = "";
        return;
      }

      setSelectedFile(null);
      setSelectedImage(file);

      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);

      return;
    }

    if (file.type !== "application/pdf") {
      setUploadError("Only PDF or image files are allowed.");
      e.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("PDF must be smaller than 10 MB.");
      e.target.value = "";
      return;
    }

    setSelectedImage(null);
    setImagePreview("");
    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview("");
    setUploadError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) return true;

    try {
      setUploading(true);
      setUploadError("");

      const token = localStorage.getItem("token");

      const formData = new FormData();
      formData.append("document", selectedFile);

      const response = await fetch(
        apiUrl("/api/documents/upload"),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "PDF upload failed");
      }

      console.log("PDF Upload:", data);

      return true;
    } catch (error) {
      console.error("PDF Upload Error:", error);

      setUploadError(
        error.message || "Failed to upload PDF.",
      );

      return false;
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (
      !message.trim() &&
      !selectedFile &&
      !selectedImage
    ) {
      return;
    }

    /* =========================
       PDF
    ========================= */

    if (selectedFile) {
      const uploaded = await uploadFile();

      if (!uploaded) return;

      const typedMessage = message.trim();

      const documentData = {
        name: selectedFile.name,
        type: selectedFile.type,
        uploaded: true,
        hasQuestion: Boolean(typedMessage),
      };

      onSend(
        typedMessage ||
          `I uploaded a PDF document named "${selectedFile.name}".`,
        null,
        null,
        documentData,
      );

      setMessage("");
      setSelectedFile(null);
      setUploadError("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      if (textareaRef.current) {
        textareaRef.current.style.height = "46px";
      }

      return;
    }

    /* =========================
       IMAGE
    ========================= */

    if (selectedImage) {
      const imageElement = selectedImageRef.current;

      const sourceRect =
        imageElement?.getBoundingClientRect();

      onSend(
        message.trim(),
        selectedImage,
        {
          animateImage: true,
          sourceRect: sourceRect
            ? {
                left: sourceRect.left,
                top: sourceRect.top,
                width: sourceRect.width,
                height: sourceRect.height,
              }
            : null,
        },
      );

      setMessage("");
      setSelectedImage(null);
      setImagePreview("");
      setUploadError("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      if (textareaRef.current) {
        textareaRef.current.style.height = "46px";
      }

      return;
    }

    /* =========================
       NORMAL MESSAGE
    ========================= */

    if (message.trim()) {
      onSend(message);
    }

    setMessage("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "46px";
    }
  };

  return (
    <div className="input-box">
      <div className="input-controls">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf,image/*"
          onChange={handleFileSelect}
          hidden
        />

        {(selectedFile || selectedImage) && (
          <div className="input-attachment-area">
            {selectedImage && (
              <div
                ref={selectedImageRef}
                className="selected-image"
              >
                <div className="selected-image-preview">
                  <img
                    src={imagePreview}
                    alt="Selected"
                  />
                </div>

                <div className="selected-image-info">
                  <ImageIcon size={15} />

                  <span title={selectedImage.name}>
                    {selectedImage.name}
                  </span>
                </div>

                <button
                  type="button"
                  className="remove-file-btn"
                  onClick={handleRemoveImage}
                  disabled={uploading}
                  title="Remove image"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {selectedFile && (
              <div className="selected-file">
                <div className="selected-file-info">
                  <FileText size={18} />

                  <span title={selectedFile.name}>
                    {selectedFile.name}
                  </span>
                </div>

                <button
                  type="button"
                  className="remove-file-btn"
                  onClick={handleRemoveFile}
                  disabled={uploading}
                  title="Remove PDF"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {uploadError && (
          <div className="upload-error">
            {uploadError}
          </div>
        )}

        {voiceError && <div className="upload-error" role="alert">{voiceError}</div>}

        {showTemplates && (
          <section className="prompt-template-popover" aria-label="Prompt templates">
            <div className="prompt-template-heading">
              <strong>Prompt templates</strong>
              <button type="button" className="prompt-template-add" onClick={() => setIsAddingTemplate((value) => !value)}>
                <Plus size={14} /> Add your own
              </button>
            </div>
            <div className="prompt-template-list">
              {[...builtInPromptTemplates, ...customTemplates].map((template) => (
                <div className="prompt-template-row" key={template.id}>
                  <button type="button" className="prompt-template-item" onClick={() => selectPromptTemplate(template.prompt)}>
                    <strong>{template.title}</strong>
                    <span>{template.prompt.replace(/\s+/g, " ")}</span>
                  </button>
                  {template.id.startsWith("custom-") && (
                    <button type="button" className="prompt-template-delete" onClick={() => deletePromptTemplate(template.id)} aria-label={`Delete ${template.title}`} title="Delete template">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isAddingTemplate && (
              <form className="prompt-template-form" onSubmit={savePromptTemplate}>
                <input value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} placeholder="Template name" maxLength={40} required />
                <textarea value={templatePrompt} onChange={(event) => setTemplatePrompt(event.target.value)} placeholder="Prompt text" maxLength={2000} required />
                <button type="submit" disabled={!templateTitle.trim() || !templatePrompt.trim()}>Save template</button>
              </form>
            )}
          </section>
        )}

        {showImageGenerator && (
          <form className="image-generator-panel" onSubmit={submitImageGeneration}>
            <div className="image-generator-heading"><strong>Create an image</strong><span>Stable Diffusion XL</span></div>
            <textarea value={imagePrompt} onChange={(event) => setImagePrompt(event.target.value)} placeholder="Describe the image you want to create…" maxLength={1500} required disabled={isGeneratingImage} aria-label="Image generation prompt" />
            {imageGenerationError && <p className="image-generator-error" role="alert">{imageGenerationError}</p>}
            <div className="image-generator-footer"><span>{imagePrompt.length}/1500</span><button type="submit" disabled={!imagePrompt.trim() || isGeneratingImage || isThinking}>{isGeneratingImage ? <><LoaderCircle size={14} className="image-generator-spinner" /> Creating…</> : <><ImagePlus size={14} /> Generate image</>}</button></div>
          </form>
        )}

        <div className="input-main-row">
          {SpeechRecognitionApi && (
            <button
              type="button"
              className={`attach-btn voice-input-btn ${isListening ? "listening" : ""}`}
              onClick={toggleVoiceInput}
              disabled={isThinking || uploading}
              title={isListening ? "Stop voice input" : "Dictate message"}
              aria-label={isListening ? "Stop voice input" : "Dictate message"}
              aria-pressed={isListening}
            >
              {isListening ? <MicOff size={17} /> : <Mic size={17} />}
              {isListening && (
                <span className="voice-waveform" aria-hidden="true">
                  <i /><i /><i />
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            className="attach-btn"
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={isThinking || uploading}
            title="Attach PDF or image"
          >
            <Paperclip size={18} />
          </button>

          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                sendOnEnter
              ) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isListening ? "Listening… speak now" : sendOnEnter ? "Message Velora AI..." : "Message Velora AI... (Enter for new line)"}
            rows="1"
          />

          <button
            className="send-btn"
            onClick={
              isThinking ? onStop : handleSend
            }
            disabled={
              isThinking
                ? false
                : !message.trim() &&
                  !selectedFile &&
                  !selectedImage
            }
          >
            {isThinking ? (
              <Square size={15} />
            ) : uploading ? (
              "..."
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <div className="input-footer-tools">
          <button type="button" className={`prompt-template-toggle ${showTemplates ? "active" : ""}`} onClick={() => setShowTemplates((value) => !value)} aria-expanded={showTemplates}>
            <Sparkles size={13} /> Prompt templates
          </button>
          {onGenerateImage && <button type="button" className={`prompt-template-toggle image-generator-toggle ${showImageGenerator ? "active" : ""}`} onClick={() => { setShowImageGenerator((value) => !value); setShowTemplates(false); setImageGenerationError(""); }} aria-expanded={showImageGenerator} disabled={isThinking || isGeneratingImage}>
            <ImagePlus size={13} /> Create image
          </button>}
          <div className="input-shortcut-hint">
            Focus: <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InputBox;
