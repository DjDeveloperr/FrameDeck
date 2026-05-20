// Device registry — pure data, no fs imports. Suitable for the browser.
//
// To load from disk in Node, use `loadDeviceIndexFromFs` and pass the result
// to the constructor. On the web, fetch index.json over HTTP and pass the
// parsed object directly. The `assetsRoot` may be either a filesystem path
// (for the Node renderer) or a URL prefix like "/api/assets/device-bezels"
// (for the Web renderer).

export type DeviceFamily = "iphone" | "ipad" | "apple-watch";

export interface DeviceGeometry {
  totalWidth: number;
  totalHeight: number;
  chromeX: number;
  chromeY: number;
  chromeWidth: number;
  chromeHeight: number;
  chromeCornerRadius: number;
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
  cornerRadius: number;
  hasScreenMask: boolean;
}

export interface DeviceImages {
  bezel: string;
  bezelNoButtons: string;
  screenMask?: string;
}

export interface DeviceRenderedSize {
  pixelWidth: number;
  pixelHeight: number;
}

export interface DeviceScreen {
  pixelWidth: number;
  pixelHeight: number;
  scale: number;
}

export interface DeviceProfile {
  slug: string;
  name: string;
  family: DeviceFamily;
  modelIdentifier: string;
  geometry: DeviceGeometry;
  images: DeviceImages;
  rendered: {
    bezel: DeviceRenderedSize;
    bezelNoButtons: DeviceRenderedSize;
    screenMask?: DeviceRenderedSize;
  };
  screen: DeviceScreen;
}

export interface DeviceIndex {
  devices: DeviceProfile[];
  counts?: Record<string, number>;
}

export class DeviceRegistry {
  private readonly profilesBySlug = new Map<string, DeviceProfile>();
  private readonly profilesByModel = new Map<string, DeviceProfile>();

  constructor(public readonly assetsRoot: string, indexData: DeviceIndex) {
    for (const device of indexData.devices) {
      this.profilesBySlug.set(device.slug, device);
      this.profilesByModel.set(device.modelIdentifier.toLowerCase(), device);
    }
  }

  resolve(idOrSlug: string): DeviceProfile {
    const direct = this.profilesBySlug.get(idOrSlug);
    if (direct) return direct;
    const byModel = this.profilesByModel.get(idOrSlug.toLowerCase());
    if (byModel) return byModel;
    const friendly = this.resolveFriendly(idOrSlug);
    if (friendly) return friendly;
    throw new Error(`Unknown device: ${idOrSlug}`);
  }

  private resolveFriendly(query: string): DeviceProfile | undefined {
    const q = query.toLowerCase();
    let best: DeviceProfile | undefined;
    for (const profile of this.profilesBySlug.values()) {
      if (profile.slug === q) return profile;
      if (profile.slug.startsWith(q + "-")) {
        if (!best || profile.slug.length < best.slug.length) best = profile;
      }
    }
    return best;
  }

  list(family?: DeviceFamily): DeviceProfile[] {
    const all = [...this.profilesBySlug.values()];
    return family ? all.filter((d) => d.family === family) : all;
  }

  /** Join the assetsRoot with a relative image path. Detects URL vs path. */
  imagePath(profile: DeviceProfile, kind: keyof DeviceImages): string {
    const rel = profile.images[kind];
    if (!rel) throw new Error(`Device ${profile.slug} has no ${kind} image`);
    return joinAsset(this.assetsRoot, rel);
  }
}

export function joinAsset(root: string, rel: string): string {
  // Normalize backslashes in case the index was serialized on Windows.
  const safeRel = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  if (/^[a-z]+:\/\//i.test(root) || root.startsWith("/")) {
    // URL prefix or absolute web path.
    const base = root.replace(/\/+$/, "");
    return `${base}/${safeRel}`;
  }
  // Filesystem path. Use a manual join to avoid pulling node:path in browser builds.
  const trimmed = root.replace(/\/+$/, "");
  return `${trimmed}/${safeRel}`;
}
