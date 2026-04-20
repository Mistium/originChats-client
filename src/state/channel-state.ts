/**
 * channel-state.ts — Channel loading / scroll state
 *
 * Tracks which channels have been loaded, whether the oldest/newest
 * message boundary has been reached, and missed-message counts.
 * These were previously loose Record<string, Set<string>> objects
 * on the old monolithic state.ts.
 */

/** Which channels have had their initial messages fetched. */
export const loadedChannelsByServer: Record<string, Set<string>> = {};

/** Channels where we've reached the oldest available message. */
export const reachedOldestByServer: Record<string, Set<string>> = {};

/** Channels where we've reached the newest available message. */
export const reachedNewestByServer: Record<string, Set<string>> = {};

/** Helper to clear all loading state for a server (on disconnect). */
export function clearChannelLoadState(sUrl: string): void {
  delete loadedChannelsByServer[sUrl];
  delete reachedOldestByServer[sUrl];
  delete reachedNewestByServer[sUrl];
}
