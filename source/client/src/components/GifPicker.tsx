import { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';

// Giphy public beta key - replace with your own for production
const GIPHY_API_KEY = 'dc6zaTOxFJmzC';
const GIPHY_API_URL = 'https://api.giphy.com/v1/gifs';

interface GifResult {
  id: string;
  title: string;
  images: {
    fixed_height: {
      url: string;
      width: string;
      height: string;
    };
    fixed_height_small: {
      url: string;
      width: string;
      height: string;
    };
    original: {
      url: string;
    };
  };
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Load trending GIFs on mount
  useEffect(() => {
    fetchTrending();
    inputRef.current?.focus();
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!search.trim()) {
      fetchTrending();
      return;
    }

    debounceRef.current = setTimeout(() => {
      searchGifs(search);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [search]);

  const fetchTrending = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${GIPHY_API_URL}/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=pg-13`
      );
      const data = await response.json();
      setGifs(data.data || []);
    } catch {
      setError('Failed to load GIFs');
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${GIPHY_API_URL}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=pg-13`
      );
      const data = await response.json();
      setGifs(data.data || []);
    } catch {
      setError('Failed to search GIFs');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (gif: GifResult) => {
    // Use the fixed_height version for good quality without being too large
    onSelect(gif.images.fixed_height.url);
    onClose();
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 bg-white rounded-lg shadow-xl border z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b bg-slate-50">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search GIFs..."
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* GIF Grid */}
      <div className="h-64 overflow-y-auto p-2">
        {loading && gifs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {error}
          </div>
        ) : gifs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            No GIFs found
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => handleSelect(gif)}
                className="relative overflow-hidden rounded-md hover:ring-2 hover:ring-blue-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <img
                  src={gif.images.fixed_height_small.url}
                  alt={gif.title}
                  className="w-full h-24 object-cover bg-slate-100"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Giphy Attribution */}
      <div className="px-3 py-2 border-t bg-slate-50 flex items-center justify-center">
        <img
          src="https://giphy.com/static/img/poweredby_giphy.png"
          alt="Powered by GIPHY"
          className="h-4"
        />
      </div>
    </div>
  );
}
