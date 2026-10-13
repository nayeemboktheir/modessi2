import { useEffect, useState } from 'react';

// True only for a fine pointer that can hover (mouse / trackpad). Parallax and
// tilt are skipped on touch screens, where they cost frames and never read well.
export function useCanHover() {
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setCanHover(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return canHover;
}
