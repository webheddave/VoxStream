import React, { useEffect, useRef } from 'react';
import { AudioVisualizerProps } from '../types';

const Visualizer: React.FC<AudioVisualizerProps> = ({ analyser, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      if (!analyser) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw a flat line if inactive
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.stroke();
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2; // Scale down slightly
        
        // Create gradient
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, '#ffffff');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, color]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={150}
      className="w-full h-32 bg-slate-800/50 rounded-lg backdrop-blur-sm border border-slate-700 shadow-inner"
    />
  );
};

export default Visualizer;