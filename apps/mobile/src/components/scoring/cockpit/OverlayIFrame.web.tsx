import { createElement } from 'react';

/** Web: embed the existing scoring-overlay page. */
export function OverlayIFrame({ src }: { src: string }): React.ReactElement {
  return createElement('iframe', {
    src,
    title: 'Live scoreboard overlay',
    style: {
      width: '100%',
      height: '100%',
      border: 'none',
      backgroundColor: 'transparent',
    },
  });
}
