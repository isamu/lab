// The part of a bundler's import.meta.glob (Vite's) that browser/detectors.ts uses: the matching modules' named export,
// by path, imported when the bundle loads.
interface ImportMeta {
  glob(patterns: string | readonly string[], options: { readonly eager: true; readonly import: string }): Readonly<Record<string, unknown>>;
}
