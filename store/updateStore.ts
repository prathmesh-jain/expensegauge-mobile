import { create } from 'zustand';

interface UpdateState {
    isUpdateAvailable: boolean;
    isDownloading: boolean;
    isUpdateReady: boolean;
    forceUpdate: boolean;
    updateType: 'OTA' | 'APK' | 'PlayStore' | 'none';
    latestAppVersion: string;
    latestOtaVersion: string;
    apkUrl: string;
    playStoreUrl: string;
    message: string;

    setUpdateStatus: (status: Partial<Omit<UpdateState, 'setUpdateStatus' | 'reset'>>) => void;
    reset: () => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
    isUpdateAvailable: false,
    isDownloading: false,
    isUpdateReady: false,
    forceUpdate: false,
    updateType: 'none',
    latestAppVersion: '',
    latestOtaVersion: '',
    apkUrl: '',
    playStoreUrl: '',
    message: '',

    setUpdateStatus: (status) => set((state) => ({ ...state, ...status })),
    reset: () => set({
        isUpdateAvailable: false,
        isDownloading: false,
        isUpdateReady: false,
        forceUpdate: false,
        updateType: 'none',
        latestAppVersion: '',
        latestOtaVersion: '',
        apkUrl: '',
        playStoreUrl: '',
        message: '',
    }),
}));
