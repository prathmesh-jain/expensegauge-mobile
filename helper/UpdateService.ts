import * as Updates from 'expo-updates';
import api from '../api/api';
import { useUpdateStore } from '../store/updateStore';

class UpdateService {
    async checkForUpdates() {
        const { setUpdateStatus } = useUpdateStore.getState();

        try {
            // 1. Check Backend for update instructions
            const response = await api.get('/update/check');
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
