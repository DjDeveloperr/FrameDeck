# Device Bezel Extraction

FrameDeck's initial device bezels were extracted from the local Xcode
CoreSimulator and DeviceKit installation, using SimDeck's `XCWChromeRenderer` as
the reference implementation.

The useful path is:

1. Enumerate `/Library/Developer/CoreSimulator/Profiles/DeviceTypes/*.simdevicetype`.
2. Read each `Contents/Resources/profile.plist`.
3. Keep `iPhone`, `iPad`, and `Apple Watch` device types.
4. Read `chromeIdentifier`, strip `com.apple.dt.devicekit.chrome.`, and load:
   `/Library/Developer/DeviceKit/Chrome/<chrome>.devicechrome/Contents/Resources/chrome.json`.
5. Render the PDF pieces listed in `chrome.json`, then clear the screen area
   using geometry from the device profile and framebuffer mask.

The extracted assets live in `assets/device-bezels`:

- `<family>/<device-slug>/bezel.png`: transparent screen opening, side buttons included.
- `<family>/<device-slug>/bezel-no-buttons.png`: same frame without button overlays.
- `<family>/<device-slug>/screen-mask.png`: present when the simulator profile has a framebuffer mask.
- `<family>/<device-slug>/profile.json`: per-device screen, chrome, source, and geometry metadata.
- `index.json`: aggregate manifest for all extracted devices.

Regenerate with:

```bash
./scripts/extract-device-bezels.sh
```

The original vector sources can be extracted separately into
`assets/device-bezel-vectors`:

```bash
./scripts/extract-device-bezel-vectors.sh
```

That vector tree de-duplicates shared DeviceKit chrome bundles under `chrome/`
and stores per-device `profile.json` files that point to local PDF assets,
framebuffer masks, sensor bars, and SimDeck-derived placement geometry.

Set `SIMDECK_ROOT=/path/to/SimDeck` if SimDeck is not at `~/Developer/SimDeck`.
