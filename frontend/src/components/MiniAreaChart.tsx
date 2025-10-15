'use client';

import React from 'react';

export type Point = { x: number; y: number };

type Props = {
  width?: number;
  height?: number;
  data: Point[]; // assume data.x increasing
  stroke?: string;
  fill?: string;
};

export default function MiniAreaChart({
  width = 600,
  height = 160,
  data,
  stroke = 'rgb(96 165 250)', // blue-400
  fill = 'rgba(96, 165, 250, 0.2)',
}: Props) {
  if (!data || data.length === 0) {
    return <div className="muted text-sm">No data</div>;
  }

  const minX = data[0].x;
  const maxX = data[data.length - 1].x;
  const minY = 0;
  const maxY = data.reduce((m, p) => (p.y > m ? p.y : m), 0);

  const dx = Math.max(1, maxX - minX);
  const dy = Math.max(1, maxY - minY);

  const scaleX = (x: number) => ((x - minX) / dx) * width;
  const scaleY = (y: number) => height - ((y - minY) / dy) * height;

  const path = data
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x).toFixed(2)} ${scaleY(p.y).toFixed(2)}`)
    .join(' ');

  const area = `${path} L ${scaleX(maxX).toFixed(2)} ${scaleY(0).toFixed(2)} L ${scaleX(minX).toFixed(2)} ${scaleY(0).toFixed(2)} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Area chart">
      <path d={area} fill={fill} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} />
    </svg>
  );
}
