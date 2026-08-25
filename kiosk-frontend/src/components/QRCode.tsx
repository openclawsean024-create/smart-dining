import { useEffect, useRef, useState } from 'react';
import QRCodeLib from 'qrcode';

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCode({ value, size = 220, className }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#1F2937',
        light: '#FFFFFF',
      },
    })
      .then(() => setError(null))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'QR code error'));
  }, [value, size]);

  if (error) {
    return (
      <div
        className={'flex items-center justify-center text-gray-400 text-sm ' + (className ?? '')}
        style={{ width: size, height: size }}
      >
        QR 產生失敗
      </div>
    );
  }

  return <canvas ref={canvasRef} className={className} />;
}
