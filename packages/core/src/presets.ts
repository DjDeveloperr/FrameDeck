// App Store screenshot presets.
//
// Source: Apple App Store Connect requirements (current as of the project's
// reference date). These cover the resolutions Apple will accept for the
// canonical "6.5"/13"/Watch" display sizes. New iPhones and iPads typically
// fall back to one of the canonical sets, so an asset that satisfies a preset
// here is universally accepted.
//
// Each preset is a canvas size — pair it with a representative <Device
// model="..."> in a .screen file. Apple's display sizes are larger than the
// actual device pixel resolution; the extra room is the canvas padding around
// the device.

export interface ScreenPreset {
  /** Stable id used in project.json exports and CLI flags. */
  id: string;
  /** Display label for UI. */
  label: string;
  /** Output canvas size, "WxH" string parseable by parseSize. */
  size: string;
  /** Suggested orientation. */
  orientation: "portrait" | "landscape";
  /** Suggested device model slug. */
  suggestedDevice?: string;
  /** Apple App Store category this preset satisfies. */
  category: "iphone-6.5" | "iphone-6.9" | "ipad-13" | "apple-watch";
  /** Apple Watch series the preset targets, if applicable. */
  watchSeries?: "ultra-3" | "series-11" | "series-9" | "series-6" | "series-3";
}

// iPhone — 6.5" display (covers the 6.9" submission too via the larger canvas).
export const IPHONE_6_5_PORTRAIT: ScreenPreset = {
  id: "iphone-6.5-portrait",
  label: 'iPhone 6.5" (Portrait)',
  size: "1242x2688",
  orientation: "portrait",
  category: "iphone-6.5",
  suggestedDevice: "iphone-11-pro-max",
};
export const IPHONE_6_5_LANDSCAPE: ScreenPreset = {
  id: "iphone-6.5-landscape",
  label: 'iPhone 6.5" (Landscape)',
  size: "2688x1242",
  orientation: "landscape",
  category: "iphone-6.5",
  suggestedDevice: "iphone-11-pro-max",
};
export const IPHONE_6_9_PORTRAIT: ScreenPreset = {
  id: "iphone-6.9-portrait",
  label: 'iPhone 6.9" (Portrait)',
  size: "1284x2778",
  orientation: "portrait",
  category: "iphone-6.9",
  suggestedDevice: "iphone-16-pro-max",
};
export const IPHONE_6_9_LANDSCAPE: ScreenPreset = {
  id: "iphone-6.9-landscape",
  label: 'iPhone 6.9" (Landscape)',
  size: "2778x1284",
  orientation: "landscape",
  category: "iphone-6.9",
  suggestedDevice: "iphone-16-pro-max",
};

// iPad — 13" display.
export const IPAD_13_PORTRAIT_NEW: ScreenPreset = {
  id: "ipad-13-portrait",
  label: 'iPad 13" (Portrait, M-series)',
  size: "2064x2752",
  orientation: "portrait",
  category: "ipad-13",
  suggestedDevice: "ipad-pro-13-m4",
};
export const IPAD_13_LANDSCAPE_NEW: ScreenPreset = {
  id: "ipad-13-landscape",
  label: 'iPad 13" (Landscape, M-series)',
  size: "2752x2064",
  orientation: "landscape",
  category: "ipad-13",
  suggestedDevice: "ipad-pro-13-m4",
};
export const IPAD_13_PORTRAIT_LEGACY: ScreenPreset = {
  id: "ipad-13-portrait-legacy",
  label: 'iPad 12.9" (Portrait, legacy)',
  size: "2048x2732",
  orientation: "portrait",
  category: "ipad-13",
  suggestedDevice: "ipad-pro-12-9-inch-6th-generation",
};
export const IPAD_13_LANDSCAPE_LEGACY: ScreenPreset = {
  id: "ipad-13-landscape-legacy",
  label: 'iPad 12.9" (Landscape, legacy)',
  size: "2732x2048",
  orientation: "landscape",
  category: "ipad-13",
  suggestedDevice: "ipad-pro-12-9-inch-6th-generation",
};

// Apple Watch.
export const WATCH_ULTRA_3_LARGE: ScreenPreset = {
  id: "watch-ultra-3-large",
  label: "Apple Watch Ultra 3 (large)",
  size: "422x514",
  orientation: "portrait",
  category: "apple-watch",
  watchSeries: "ultra-3",
  suggestedDevice: "apple-watch-ultra-3-49mm",
};
export const WATCH_ULTRA_3_SMALL: ScreenPreset = {
  id: "watch-ultra-3-small",
  label: "Apple Watch Ultra 3 (small)",
  size: "410x502",
  orientation: "portrait",
  category: "apple-watch",
  watchSeries: "ultra-3",
  suggestedDevice: "apple-watch-ultra-3-49mm",
};
export const WATCH_SERIES_11: ScreenPreset = {
  id: "watch-series-11",
  label: "Apple Watch Series 11",
  size: "416x496",
  orientation: "portrait",
  category: "apple-watch",
  watchSeries: "series-11",
  suggestedDevice: "apple-watch-series-11-46mm",
};
export const WATCH_SERIES_9: ScreenPreset = {
  id: "watch-series-9",
  label: "Apple Watch Series 9",
  size: "396x484",
  orientation: "portrait",
  category: "apple-watch",
  watchSeries: "series-9",
};
export const WATCH_SERIES_6: ScreenPreset = {
  id: "watch-series-6",
  label: "Apple Watch Series 6",
  size: "368x448",
  orientation: "portrait",
  category: "apple-watch",
  watchSeries: "series-6",
};
export const WATCH_SERIES_3: ScreenPreset = {
  id: "watch-series-3",
  label: "Apple Watch Series 3",
  size: "312x390",
  orientation: "portrait",
  category: "apple-watch",
  watchSeries: "series-3",
};

export const APP_STORE_PRESETS: ScreenPreset[] = [
  IPHONE_6_9_PORTRAIT,
  IPHONE_6_9_LANDSCAPE,
  IPHONE_6_5_PORTRAIT,
  IPHONE_6_5_LANDSCAPE,
  IPAD_13_PORTRAIT_NEW,
  IPAD_13_LANDSCAPE_NEW,
  IPAD_13_PORTRAIT_LEGACY,
  IPAD_13_LANDSCAPE_LEGACY,
  WATCH_ULTRA_3_LARGE,
  WATCH_ULTRA_3_SMALL,
  WATCH_SERIES_11,
  WATCH_SERIES_9,
  WATCH_SERIES_6,
  WATCH_SERIES_3,
];

export function findPreset(id: string): ScreenPreset | undefined {
  return APP_STORE_PRESETS.find((p) => p.id === id);
}

export function presetsByCategory(category: ScreenPreset["category"]): ScreenPreset[] {
  return APP_STORE_PRESETS.filter((p) => p.category === category);
}
