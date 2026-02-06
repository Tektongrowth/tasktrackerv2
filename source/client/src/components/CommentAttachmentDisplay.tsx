import { useState, useEffect } from 'react';
import { X, Paperclip, ImageIcon } from 'lucide-react';
import { comments as commentsApi } from '@/lib/api';
import type { CommentAttachment } from '@/lib/types';

interface CommentAttachmentDisplayProps {
  attachment: CommentAttachment;
  taskId: string;
  commentId: string;
}

export function CommentAttachmentDisplay({ attachment, taskId, commentId }: CommentAttachmentDisplayProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const isImage = attachment.fileType.startsWith('image/');

  useEffect(() => {
    if (!isImage) {
      setLoading(false);
      return;
    }

    commentsApi.getAttachmentSignedUrl(taskId, commentId, attachment.id)
      .then(({ url }) => {
        setImageUrl(url);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [taskId, commentId, attachment.id, isImage]);

  const handleClick = async () => {
    if (imageUrl) {
      setShowLightbox(true);
    } else {
      try {
        const { url } = await commentsApi.getAttachmentSignedUrl(taskId, commentId, attachment.id);
        setImageUrl(url);
        setShowLightbox(true);
      } catch {
        window.open(commentsApi.getAttachmentUrl(taskId, commentId, attachment.id), '_blank');
      }
    }
  };

  if (isImage) {
    return (
      <>
        <div
          className="cursor-pointer"
          onClick={handleClick}
        >
          {loading ? (
            <div className="w-48 h-32 bg-muted rounded-md animate-pulse flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md hover:bg-muted/80 transition-colors w-fit">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{attachment.fileName}</span>
              <span className="text-xs text-muted-foreground">(click to view)</span>
            </div>
          ) : (
            <img
              src={imageUrl!}
              alt={attachment.fileName}
              className="max-w-xs max-h-48 rounded-md border hover:opacity-90 transition-opacity"
            />
          )}
        </div>
        {showLightbox && imageUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setShowLightbox(false)}
          >
            <button
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-50"
              onClick={() => setShowLightbox(false)}
              aria-label="Close lightbox"
            >
              <X className="h-8 w-8" />
            </button>
            <img
              src={imageUrl}
              alt={attachment.fileName}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </>
    );
  }

  return (
    <a
      href={commentsApi.getAttachmentUrl(taskId, commentId, attachment.id)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-2 bg-muted rounded-md hover:bg-muted/80 transition-colors w-fit"
    >
      <Paperclip className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">{attachment.fileName}</span>
      <span className="text-xs text-muted-foreground">
        ({(attachment.fileSize / 1024).toFixed(0)} KB)
      </span>
    </a>
  );
}
