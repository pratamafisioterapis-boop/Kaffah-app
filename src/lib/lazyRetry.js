import { isStaleChunkError, reloadForStaleChunk } from '@/lib/staleChunk';

// After every deploy, Vite's content-hashed chunk filenames change. A tab
// that was already open (or briefly, the CDN edge still propagating a very
// recent deploy) can try to dynamically import a chunk URL that no longer
// exists, throwing "Failed to fetch dynamically imported module". Wrap
// React.lazy() imports with this so a transient miss gets a couple of quick
// retries, and only a real version-skew falls back to one full page reload
// (guarded per-chunk in sessionStorage so it can't loop forever).

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const lazyRetry = (componentImport, chunkName) => async () => {
  try {
    return await componentImport();
  } catch (error) {
    if (!isStaleChunkError(error)) throw error;

    for (const delay of [500, 1500]) {
      await wait(delay);
      try {
        return await componentImport();
      } catch {
        // keep retrying / fall through to reload below
      }
    }

    if (reloadForStaleChunk(`lazy-${chunkName}`)) {
      // Block forever — the page is about to reload, don't let React render an error state.
      return new Promise(() => {});
    }

    throw error;
  }
};
