"use client";

// Compact line-icon set. Single-source, single-style — every icon is a stroke
// path on a 16-unit grid with `currentColor`, 1.5px stroke, round caps/joins.
// Use via <Icon name="..." size={16} /> or the individual components.

import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "ref"> & { size?: number };

function makeIcon(d: React.ReactNode) {
  function I({ size = 16, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
      >
        {d}
      </svg>
    );
  }
  return I;
}

export const IconChevronLeft = makeIcon(<path d="M10 3.5 5.5 8 10 12.5" />);
export const IconChevronRight = makeIcon(<path d="M6 3.5 10.5 8 6 12.5" />);
export const IconChevronDown = makeIcon(<path d="M3.5 6 8 10.5 12.5 6" />);
export const IconX = makeIcon(<path d="M4 4l8 8M12 4l-8 8" />);
export const IconPlus = makeIcon(<path d="M8 3v10M3 8h10" />);
export const IconMinus = makeIcon(<path d="M3 8h10" />);
export const IconCheck = makeIcon(<path d="M3 8.5l3.5 3.5L13 4.5" />);
export const IconUndo = makeIcon(
  <>
    <path d="M3.5 7H10a3 3 0 0 1 0 6H6" />
    <path d="M6 4 3 7l3 3" />
  </>
);
export const IconRedo = makeIcon(
  <>
    <path d="M12.5 7H6a3 3 0 0 0 0 6h4" />
    <path d="M10 4l3 3-3 3" />
  </>
);
export const IconCode = makeIcon(
  <>
    <path d="M5 5 2 8l3 3" />
    <path d="M11 5l3 3-3 3" />
    <path d="M9 3 7 13" />
  </>
);
export const IconEye = makeIcon(
  <>
    <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4Z" />
    <circle cx="8" cy="8" r="1.6" />
  </>
);
export const IconDuplicate = makeIcon(
  <>
    <rect x="5" y="5" width="8" height="8" rx="1.5" />
    <path d="M3 11V4a1 1 0 0 1 1-1h7" />
  </>
);
export const IconTrash = makeIcon(
  <>
    <path d="M3 4.5h10" />
    <path d="M5 4.5V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    <path d="M4.5 4.5 5 13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5" />
  </>
);
export const IconHome = makeIcon(<path d="M3 8 8 3l5 5v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Z" />);
export const IconZoomIn = makeIcon(
  <>
    <circle cx="7" cy="7" r="3.5" />
    <path d="M9.5 9.5 13 13" />
    <path d="M5.5 7h3M7 5.5v3" />
  </>
);
export const IconZoomOut = makeIcon(
  <>
    <circle cx="7" cy="7" r="3.5" />
    <path d="M9.5 9.5 13 13" />
    <path d="M5.5 7h3" />
  </>
);
export const IconMaximize = makeIcon(
  <>
    <path d="M3 6V3h3" />
    <path d="M13 6V3h-3" />
    <path d="M3 10v3h3" />
    <path d="M13 10v3h-3" />
  </>
);
export const IconLayers = makeIcon(
  <>
    <path d="M8 2 1.5 5.5 8 9l6.5-3.5L8 2Z" />
    <path d="M2 10l6 3.5L14 10" />
  </>
);
export const IconSliders = makeIcon(
  <>
    <path d="M3 4h7" />
    <path d="M12 4h1" />
    <circle cx="11" cy="4" r="1.2" />
    <path d="M3 12h2" />
    <path d="M7 12h6" />
    <circle cx="6" cy="12" r="1.2" />
    <path d="M3 8h4" />
    <path d="M9 8h4" />
    <circle cx="8" cy="8" r="1.2" />
  </>
);
export const IconText = makeIcon(
  <>
    <path d="M3 4h10" />
    <path d="M8 4v9" />
  </>
);
export const IconImage = makeIcon(
  <>
    <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
    <circle cx="6" cy="6.5" r="1" />
    <path d="m2.8 11 3.2-3 2.5 2 1.5-1.5L13 11" />
  </>
);
export const IconSquare = makeIcon(<rect x="3" y="3" width="10" height="10" rx="1.5" />);
export const IconCircle = makeIcon(<circle cx="8" cy="8" r="5" />);
export const IconRows = makeIcon(
  <>
    <rect x="2.5" y="3" width="11" height="4" rx="1" />
    <rect x="2.5" y="9" width="11" height="4" rx="1" />
  </>
);
export const IconColumns = makeIcon(
  <>
    <rect x="3" y="2.5" width="4" height="11" rx="1" />
    <rect x="9" y="2.5" width="4" height="11" rx="1" />
  </>
);
export const IconDevice = makeIcon(
  <>
    <rect x="5" y="1.5" width="6" height="13" rx="1.5" />
    <path d="M7.25 12.75h1.5" />
  </>
);
export const IconBackground = makeIcon(<rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />);
export const IconGradient = makeIcon(
  <>
    <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
    <path d="M2.5 7.5h11" />
    <path d="M2.5 5h11M2.5 10h11M2.5 12h11" strokeOpacity="0.4" />
  </>
);
