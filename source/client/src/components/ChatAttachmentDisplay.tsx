import { useState, useEffect } from 'react';
import { File } from 'lucide-react';
import { chats as chatsApi } from '@/lib/api';

export function ChatAttachmentDisplay({
  attachment,
}: {
  attachment: { id: string; fileName: string; fileType: string; storageKey: string };
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const isImage = attachment.fileType.startsWith('image/');
  const isPdf = attachment.fileType === 'application/pdf';

  useEffect(() => {
    if (!isImage) {
      setLoading(false);
      return;
    }

    chatsApi.getAttachmentSignedUrl(attachment.storageKey)
      .then(({ url }) => {
        setImageUrl(url);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [attachment.storageKey, isImage]);

  const handleClick = async () => {
    if (isImage && imageUrl) {
      window.open(imageUrl, '_blank');
    } else {
      try {
        const { url } = await chatsApi.getAttachmentSignedUrl(attachment.storageKey);
        window.open(url, '_blank');
      } catch {
        window.open(chatsApi.getAttachmentUrl(attachment.storageKey), '_blank');
      }
    }
  };

  if (isImage) {
    return (
      <div className="cursor-pointer" onClick={handleClick}>
        {loading ? (
          <div className="w-48 h-32 bg-black/10 rounded animate-pulse flex items-center justify-center">
            <File className="h-6 w-6 opacity-50" />
          </div>
        ) : error ? (
          <div className="w-48 h-32 bg-black/10 rounded flex items-center justify-center">
            <span className="text-sm opacity-70">Failed to load image</span>
          </div>
        ) : (
          <img
            src={imageUrl || ''}
            alt={attachment.fileName}
            className="max-w-full max-h-64 rounded cursor-pointer hover:opacity-90 transition-opacity"
          />
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 p-2 bg-black/10 rounded hover:bg-black/20 transition-colors text-left"
    >
      <File className={`w-4 h-4 ${isPdf ? 'text-red-500' : ''}`} />
      <span className="text-sm truncate">{attachment.fileName}</span>
      {isPdf && <span className="text-xs opacity-70">(click to view)</span>}
    </button>
  );
}
