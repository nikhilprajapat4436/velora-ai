import { useState } from "react";
import { apiUrl } from "../api";

export default function DocumentUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a PDF");
      return;
    }

    try {
      setUploading(true);
      setMessage("");

      const token = localStorage.getItem("token");

      const formData = new FormData();
      formData.append("document", file);

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
        throw new Error(data.message || "Upload failed");
      }

      setMessage(
        `Uploaded successfully: ${data.document.name}`,
      );

      setFile(null);
    } catch (error) {
      console.error("Document Upload Error:", error);
      setMessage(error.message || "Failed to upload PDF");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="application/pdf"
        onChange={(event) => {
          setFile(event.target.files?.[0] || null);
          setMessage("");
        }}
      />

      <button
        type="button"
        onClick={handleUpload}
        disabled={!file || uploading}
      >
        {uploading ? "Uploading..." : "Upload PDF"}
      </button>

      {message && <p>{message}</p>}
    </div>
  );
}
