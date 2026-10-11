import React, { useEffect, useId, useState } from 'react';
import { Platform } from 'react-native';

// Bend the real, bounded scroll viewport rather than copying transcript content.
// The map is neutral outside the feathered footer edge and regenerated on resize,
// never on scroll/audio frames. Native keeps Expo blur as its glass treatment.
export function useConversationRefraction(width: number, height: number, footerHeight: number) {
  const id = `conversation-glass-${useId().replace(/:/g, '')}-${Math.round(width)}-${Math.round(height)}-${Math.round(footerHeight)}`;
  const [map, setMap] = useState<{ id: string; uri: string } | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || width <= 0 || height <= 0) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(width); canvas.height = Math.ceil(height);
      const context = canvas.getContext('2d');
      if (!context) return;
      const pixels = context.createImageData(canvas.width, canvas.height);
      const edge = height - footerHeight - 48;
      for (let y = 0; y < canvas.height; y++) {
        const depth = (y - edge) / 96;
        const bend = depth > 0 && depth < 1 ? Math.sin(depth * Math.PI) : 0;
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          pixels.data[i] = 128 + Math.round((x / width - .5) * 32 * bend);
          pixels.data[i + 1] = 128 + Math.round(64 * bend);
          pixels.data[i + 2] = 128; pixels.data[i + 3] = 255;
        }
      }
      context.putImageData(pixels, 0, 0);
      setMap({ id, uri: canvas.toDataURL() });
    } catch { setMap(null); } // Blur/dark fade still work if canvas is unavailable.
  }, [width, height, footerHeight, id]);
  const ready = map?.id === id;
  const filter = ready ? ({ filter: `url(#${id})` } as any) : undefined;
  const definition = ready ? React.createElement('svg', { width: 0, height: 0, 'aria-hidden': true, style: { position: 'absolute', pointerEvents: 'none' } },
    React.createElement('defs', null,
      React.createElement('filter', { id, filterUnits: 'userSpaceOnUse', x: 0, y: 0, width, height, colorInterpolationFilters: 'sRGB' },
        React.createElement('feImage', { href: map!.uri, x: 0, y: 0, width, height, preserveAspectRatio: 'none', result: 'lens' }),
        React.createElement('feDisplacementMap', { in: 'SourceGraphic', in2: 'lens', scale: 32, xChannelSelector: 'R', yChannelSelector: 'G' })))) : null;
  return { filter, definition };
}
