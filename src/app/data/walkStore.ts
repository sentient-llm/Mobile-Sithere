/**
 * Shared in-memory store for a live walk session.
 * Both WalkerLiveWalk and OwnerLiveWalk subscribe to this store.
 * In production this would be powered by Supabase Realtime channels.
 */

export type WalkStatus = "idle" | "active" | "paused" | "ended";

export interface WalkState {
  status:        WalkStatus;
  dogName:       string;
  walkerName:    string;
  ownerName:     string;
  /** Auth user ID of the owner — needed for report dual-write */
  ownerId:       string | null;
  /** KV booking key, e.g. `booking:{ownerId}:{ts}` */
  bookingId:     string | null;
  /** Numeric timestamp used to locate the KV assignment record */
  bookingTs:     number | null;
  /** Array of [longitude, latitude] pairs forming the walk path */
  positions:     [number, number][];
  startTime:     number | null;
  pausedAt:      number | null;
  totalPausedMs: number;
  pottyCount:    number;
  photoCount:    number;
  waterCount:    number;
}

const DEFAULT_STATE: WalkState = {
  status:        "idle",
  dogName:       "Max",
  walkerName:    "Walker",
  ownerName:     "Dog Owner",
  ownerId:       null,
  bookingId:     null,
  bookingTs:     null,
  positions:     [],
  startTime:     null,
  pausedAt:      null,
  totalPausedMs: 0,
  pottyCount:    0,
  photoCount:    0,
  waterCount:    0,
};

let state: WalkState = { ...DEFAULT_STATE };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export const walkStore = {
  /** Snapshot accessor — pass directly to useSyncExternalStore */
  getSnapshot: (): WalkState => state,

  /** Subscribe function — pass directly to useSyncExternalStore */
  subscribe: (fn: () => void): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Merge a partial update into state and notify subscribers */
  update: (partial: Partial<WalkState>) => {
    state = { ...state, ...partial };
    notify();
  },

  /**
   * Load booking context before starting a walk.
   * Preserves any existing status so this can be called at any time.
   */
  loadBooking: (booking: {
    dogName: string;
    ownerName: string;
    ownerId: string;
    bookingId: string;
    bookingTs: number;
  }) => {
    state = {
      ...state,
      dogName:   booking.dogName,
      ownerName: booking.ownerName,
      ownerId:   booking.ownerId,
      bookingId: booking.bookingId,
      bookingTs: booking.bookingTs,
    };
    notify();
  },

  /** Hard reset back to defaults (call at the start of a new walk) */
  reset: () => {
    state = { ...DEFAULT_STATE };
    notify();
  },

  /** Computed: active elapsed ms (excluding pauses) */
  getElapsedMs: (): number => {
    if (!state.startTime) return 0;
    const base = Date.now() - state.startTime - state.totalPausedMs;
    if (state.status === "paused" && state.pausedAt) {
      return base - (Date.now() - state.pausedAt);
    }
    return base;
  },
};
