import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Trash2,
  Upload,
  X,
  LoaderCircle,
} from "lucide-react";
import "./Documents.css";
import { apiUrl } from "../../api";
import LoadingAnimation from "../LoadingAnimation";

function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteDocument, setDeleteDocument] = useState(null);
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);

  const fetchDocuments = async () => {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        apiUrl("/api/documents"),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to fetch documents",
        );
      }

      setDocuments(data.documents || []);
    } catch (error) {
      console.error("Documents Error:", error);

      setError(
        error.message || "Failed to load documents.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // The loader commits state after the network request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDocuments();
  }, []);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");

    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("PDF must be smaller than 10 MB.");
      event.target.value = "";
      return;
    }

    try {
      setUploading(true);

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
        if (response.status === 409) {
          throw new Error(
            "This PDF has already been uploaded.",
          );
        }

        throw new Error(
          data.message || "Failed to upload PDF",
        );
      }

      await fetchDocuments();
    } catch (error) {
      console.error("Upload Document Error:", error);

      setError(
        error.message || "Failed to upload PDF.",
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDelete = async (id) => {
    try {
      setDeletingId(id);
      setError("");

      const token = localStorage.getItem("token");

      const response = await fetch(
        apiUrl(`/api/documents/${id}`),
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to delete document",
        );
      }

      setDocuments((prevDocuments) =>
        prevDocuments.filter(
          (document) => document.id !== id,
        ),
      );

      setDeleteDocument(null);
    } catch (error) {
      console.error("Delete Document Error:", error);

      setError(
        error.message || "Failed to delete document.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteDocument || deletingId) return;

    handleDelete(deleteDocument.id);
  };

  if (loading) {
    return (
      <div className="documents">
        <LoadingAnimation message="Gathering your documents…" />
      </div>
    );
  }

  return (
    <section className="documents">
      <div className="documents-header">
        <div>
          <h2>Your Documents</h2>
          <p>PDFs uploaded to Velora AI</p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleUpload}
            hidden
          />

          <button
            type="button"
            className="documents-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <LoaderCircle
                  size={17}
                  className="document-upload-spinner"
                />

                <span>Processing...</span>
              </>
            ) : (
              <>
                <Upload size={17} />

                <span>Upload PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {uploading && (
        <div className="document-processing">
          <LoaderCircle
            size={16}
            className="document-upload-spinner"
          />

          <span>
            Processing your PDF. This may take a moment...
          </span>
        </div>
      )}

      {error && (
        <div className="documents-error">
          {error}
        </div>
      )}

      {documents.length === 0 ? (
        <div className="documents-empty">
          <FileText size={32} />

          <h3>No documents yet</h3>

          <p>
            Upload a PDF from here or from the chat input
            to start asking questions about it.
          </p>
        </div>
      ) : (
        <div className="documents-list">
          {documents.map((document) => (
            <div
              className="document-card"
              key={document.id}
            >
              <div className="document-icon">
                <FileText size={22} />
              </div>

              <div className="document-info">
                <h3 title={document.name}>
                  {document.name}
                </h3>

                <p>
                  {document.pages}{" "}
                  {document.pages === 1
                    ? "page"
                    : "pages"}{" "}
                  • {document.chunks} chunks
                </p>
              </div>

              <button
                type="button"
                className="document-delete-btn"
                onClick={() =>
                  setDeleteDocument(document)
                }
                disabled={
                  uploading ||
                  deletingId === document.id
                }
                title="Delete document"
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      )}

      {deleteDocument && (
        <div
          className="document-delete-modal-overlay"
          onClick={() => {
            if (!deletingId) {
              setDeleteDocument(null);
            }
          }}
        >
          <div
            className="document-delete-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="document-modal-close"
              onClick={() => setDeleteDocument(null)}
              disabled={!!deletingId}
            >
              <X size={18} />
            </button>

            <div className="document-modal-icon">
              <Trash2 size={22} />
            </div>

            <h3>Delete Document?</h3>

            <p>
              Are you sure you want to delete{" "}
              <strong>{deleteDocument.name}</strong>?
            </p>

            <div className="document-modal-actions">
              <button
                type="button"
                className="document-cancel-btn"
                onClick={() => setDeleteDocument(null)}
                disabled={!!deletingId}
              >
                Cancel
              </button>

              <button
                type="button"
                className="document-confirm-delete-btn"
                onClick={handleConfirmDelete}
                disabled={!!deletingId}
              >
                {deletingId
                  ? "Deleting..."
                  : "Delete Document"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Documents;
