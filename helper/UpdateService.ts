import * as Updates from 'expo-updates';
import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useUpdateStore } from '../store/updateStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

class UpdateService {
    async checkForUpdates() {
        const { setUpdateStatus } = useUpdateStore.getState();

        try {
            if (!API_URL) return;
            // 1. Check Backend for update instructions via public unauthenticated request
            const response = await axios.get(`${API_URL}/update/check`, {
                timeout: 10000,
                headers: {
                    'x-app-version': Constants.expoConfig?.version || '1.0.0',
                    'x-platform': Platform.OS,
                },
            });
            const data = response.data;

            if (!data.updateAvailable) {
                console.log('[UpdateService] No updates available');
                return;
            }

            setUpdateStatus({
                isUpdateAvailable: true,
                updateType: data.updateType,
                forceUpdate: data.forceUpdate,
                latestAppVersion: data.latestAppVersion,
                apkUrl: data.apkUrl,
                playStoreUrl: data.playStoreUrl,
                message: data.message,
            });

            // 2. If OTA, handle background download
            if (data.updateType === 'OTA') {
                this.handleOtaUpdate();
            }
        } catch (error) {
            console.error('[UpdateService] Error checking for updates:', error);
        }
    }

    private async handleOtaUpdate() {
        const { setUpdateStatus } = useUpdateStore.getState();

        try {
            console.log('[UpdateService] Checking for OTA update...');
            const update = await Updates.checkForUpdateAsync();

            if (update.isAvailable) {
                console.log('[UpdateService] OTA Update available, downloading...');
                setUpdateStatus({ isDownloading: true });

                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();

                console.log('[UpdateService] OTA Update downloaded and ready');
                setUpdateStatus({ isDownloading: false, isUpdateReady: true });
            } else {
                console.log('[UpdateService] No OTA update found on Expo servers');
            }
        } catch (error) {
            console.error('[UpdateService] OTA Error:', error);
            setUpdateStatus({ isDownloading: false });
        }
    }

    async reloadApp() {
        try {
            await Updates.reloadAsync();
        } catch (error) {
            console.error('[UpdateService] Failed to reload:', error);
        }
    }
}

export default new UpdateService();
