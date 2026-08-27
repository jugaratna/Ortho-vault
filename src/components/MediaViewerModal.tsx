import React, { useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw, FileText, Video as VideoIcon } from 'lucide-react';
import { MediaFile } from '../types';
import { fileUrl } from '../api/client';

interface MediaViewerModalProps {
  media: MediaFile | null;
  onClose: () => void;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({ media, onClose }) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  if (!media) return null;

  const url = fileUrl(media.storage_path, media.dataUrl);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = media.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white animate-in fade-in duration-150">
      {/* Top Controls */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h3 className="font-semibold text-sm truncate max-w-md">{media.name}</h3>
            <p className="text-xs text-neutral-400 capitalize">
              {media.section.replace('_', '-')} • {media.kind} •{' '}
              {media.size ? `${(media.size / 1024).toFixed(0)} KB` : 'Attached file'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {media.kind === 'image' && (
            <>
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-neutral-400 font-mono px-1">{(zoom * 100).toFixed(0)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                title="Rotate 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold shadow transition"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        {media.kind === 'image' ? (
          <div className="relative max-w-full max-h-full flex items-center justify-center">
            <img
              src={url}
              alt={media.name}
              className="max-h-[80vh] max-w-full object-contain rounded transition-transform duration-100 shadow-2xl"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            />
          </div>
        ) : media.kind === 'video' ? (
          <div className="w-full max-w-4xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl flex items-center justify-center">
            <video src={url} controls autoPlay className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-2xl text-center max-w-md shadow-2xl">
            <FileText className="w-16 h-16 text-teal-400 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-white mb-2">{media.name}</h4>
            <p className="text-xs text-neutral-400 mb-6">
              Clinical {media.kind.toUpperCase()} document / attachment.
            </p>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition"
            >
              <Download className="w-4 h-4" />
              Open / Download File
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
