import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

interface StreamCanvasProps {
  stream: MediaStream | null;
  className?: string;
}

export interface StreamCanvasHandle {
  captureFrame: () => string | null;
}

export const StreamCanvas = forwardRef<StreamCanvasHandle, StreamCanvasProps>(({ stream, className }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Expose capture method to parent
  useImperativeHandle(ref, () => ({
    captureFrame: () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return null;

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Return base64 JPEG
      return canvas.toDataURL('image/png', 0.8);
    }
  }));

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* The visible video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain bg-black"
      />
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />
      
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-600 bg-zinc-900/50">
          <p>No active stream</p>
        </div>
      )}
    </div>
  );
});

StreamCanvas.displayName = 'StreamCanvas';
