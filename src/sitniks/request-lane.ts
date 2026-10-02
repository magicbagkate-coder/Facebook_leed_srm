import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Requests of urgent jobs ("high") go before requests of heavy background scans ("low").
 * A job sets its lane once and every request made inside it follows that lane.
 */
export type RequestLane = 'high' | 'low';

export const laneStorage = new AsyncLocalStorage<RequestLane>();

export function currentLane(): RequestLane {
  return laneStorage.getStore() ?? 'high';
}
