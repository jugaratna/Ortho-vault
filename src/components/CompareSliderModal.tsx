import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ArrowLeftRight, Columns2, Sliders, ZoomIn, RotateCcw } from 'lucide-react';
import { fileUrl } from '../api/client';

interface CompareSliderModalProps {
  isOpen: boolean;
  onClose: () => void;
  preOpUrl: string;
  postOpUrl: string;
  preOpTitle?: string;
  postOpTitle?: string;
  patientName?: string;
}

export const CompareSliderModal: React.FC<CompareSliderModalProps> = ({
  isOpen,
  onClose,
  preOpUrl,
  postOpUrl,
  preOpTitle = 'Pre-Operative',
  postOpTitle = 'Post-Operative',
  patientName,
}) => {
  const [sliderPos, setSliderPos] = useState<number>(50); // percentage 0 - 100
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'slider' | 'side-by-side'>('slider');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    updateSlider(e.clientX);
  };

  const updateSlider = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSliderPos(percentage);
  }, []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isDragging) {
        updateSlider(e.clientX);
      }
    };

    const handlePointerUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, updateSlider]);

  if (!isOpen) return null;

  const resolvedPreUrl = fileUrl(preOpUrl);
  const resolvedPostUrl = fileUrl(postOpUrl);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white animate-in fade-in duration-200 select-none">
      {/* Lightbox Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h3 className="font-semibold text-sm sm:text-base flex items-center gap-2">
              <span>Radiological Comparison</span>
              {patientName && (
                <span className="text-xs px-2 py-0.5 rounded bg-teal-900/80 text-teal-300 border border-teal-700">
                  {patientName}
                </span>
              )}
            </h3>
            <p className="text-xs text-neutral-400">
              {viewMode === 'slider'
                ? 'Drag slider handle left/right to evaluate implant alignment and deformity correction'
                : 'Side-by-side anatomical review'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex bg-neutral-800 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setViewMode('slider')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                viewMode === 'slider' ? 'bg-teal-700 text-white font-medium shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Split Curtain</span>
            </button>
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                viewMode === 'side-by-side' ? 'bg-teal-700 text-white font-medium shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Side by Side</span>
            </button>
          </div>

          <button
            onClick={() => setZoomLevel((z) => (z >= 2 ? 1 : z + 0.5))}
            className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
            title="Zoom"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {zoomLevel > 1 && (
            <button
              onClick={() => setZoomLevel(1)}
              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
              title="Reset Zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Lightbox Body */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
        {viewMode === 'slider' ? (
          <div
            ref={containerRef}
            className="relative w-full max-w-4xl h-[70vh] max-h-[700px] rounded-xl overflow-hidden shadow-2xl bg-neutral-950 border border-neutral-800 touch-none cursor-ew-resize"
            onPointerDown={handlePointerDown}
          >
            {/* Background Image: Post-Op (Full width underneath) */}
            <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden">
              <img
                src={resolvedPostUrl}
                alt={postOpTitle}
                className="w-full h-full object-contain pointer-events-none transition-transform duration-75"
                style={{ transform: `scale(${zoomLevel})` }}
              />
              <div className="absolute top-4 right-4 bg-teal-600/90 text-white px-3 py-1 rounded text-xs font-bold tracking-wider backdrop-blur uppercase shadow">
                POST-OP
              </div>
            </div>

            {/* Foreground Image: Pre-Op (Clipped by slider position) */}
            <div
              className="absolute inset-y-0 left-0 overflow-hidden bg-black border-r border-teal-400"
              style={{ width: `${sliderPos}%` }}
            >
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  width: containerRef.current?.clientWidth || '100%',
                  height: '100%',
                }}
              >
                <img
                  src={resolvedPreUrl}
                  alt={preOpTitle}
                  className="w-full h-full object-contain pointer-events-none transition-transform duration-75"
                  style={{ transform: `scale(${zoomLevel})` }}
                />
              </div>
              <div className="absolute top-4 left-4 bg-slate-800/90 text-white px-3 py-1 rounded text-xs font-bold tracking-wider backdrop-blur uppercase shadow border border-slate-700">
                PRE-OP
              </div>
            </div>

            {/* Draggable Divider Handle */}
            <div
              className="absolute inset-y-0 -ml-4 flex items-center justify-center pointer-events-none"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="w-8 h-8 rounded-full bg-teal-500 text-white border-2 border-white shadow-xl flex items-center justify-center ring-4 ring-teal-500/30">
                <ArrowLeftRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-5xl h-[70vh] grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pre-Op Pane */}
            <div className="relative rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 flex items-center justify-center shadow-lg">
              <img
                src={resolvedPreUrl}
                alt={preOpTitle}
                className="w-full h-full object-contain transition-transform"
                style={{ transform: `scale(${zoomLevel})` }}
              />
              <div className="absolute top-4 left-4 bg-slate-800/90 text-white px-3 py-1 rounded text-xs font-bold tracking-wider backdrop-blur uppercase border border-slate-700">
                PRE-OP
              </div>
              <div className="absolute bottom-3 left-4 text-xs text-neutral-400 truncate max-w-[80%]">
                {preOpTitle}
              </div>
            </div>

            {/* Post-Op Pane */}
            <div className="relative rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 flex items-center justify-center shadow-lg">
              <img
                src={resolvedPostUrl}
                alt={postOpTitle}
                className="w-full h-full object-contain transition-transform"
                style={{ transform: `scale(${zoomLevel})` }}
              />
              <div className="absolute top-4 right-4 bg-teal-600/90 text-white px-3 py-1 rounded text-xs font-bold tracking-wider backdrop-blur uppercase shadow">
                POST-OP
              </div>
              <div className="absolute bottom-3 right-4 text-xs text-neutral-400 truncate max-w-[80%] text-right">
                {postOpTitle}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer bar */}
      <div className="px-4 py-2 bg-neutral-900/80 border-t border-neutral-800 text-center text-xs text-neutral-400">
        Use pointer or touch to drag the vertical split line across the scan.
      </div>
    </div>
  );
};
