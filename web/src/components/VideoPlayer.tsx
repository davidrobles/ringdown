import { useEffect, useRef } from 'react';
import type { Event } from '../types.ts';
import { videoUrl } from '../api.ts';

interface Props {
  event: Event;
  onClose: () => void;
  onFavorite: (id: string) => void;
}

export default function VideoPlayer({ event, onClose, onFavorite }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const date = new Date(event.created_at * 1000);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="bg-zinc-900 rounded-xl overflow-hidden w-full max-w-4xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div>
            <p className="text-sm font-semibold text-white">{event.device_name}</p>
            <p className="text-xs text-zinc-400">
              {date.toLocaleDateString()} · {date.toLocaleTimeString()} · <span className="capitalize">{event.kind}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onFavorite(event.id)}
              aria-label={event.favorited ? 'Remove from favorites' : 'Add to favorites'}
              className="transition-colors"
            >
              {event.favorited ? (
                <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-zinc-400 hover:text-red-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
              )}
            </button>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white text-xl leading-none transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Video */}
        <div className="bg-black">
          {event.downloaded ? (
            <video
              src={videoUrl(event.id)}
              controls
              autoPlay
              className="w-full max-h-[70vh]"
            />
          ) : (
            <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
              Video not yet downloaded
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
