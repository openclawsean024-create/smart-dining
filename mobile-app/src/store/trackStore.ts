import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface TrackState {
  currentOrderNo: string | null;
  vibrateOnReady: boolean;
  setCurrent: (orderNo: string | null) => void;
  setVibrate: (v: boolean) => void;
}

export const useTrackStore = create<TrackState>()(
  persist(
    (set) => ({
      currentOrderNo: null,
      vibrateOnReady: true,
      setCurrent: (orderNo) => set({ currentOrderNo: orderNo }),
      setVibrate: (v) => set({ vibrateOnReady: v }),
    }),
    {
      name: 'sd-mobile-track',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
