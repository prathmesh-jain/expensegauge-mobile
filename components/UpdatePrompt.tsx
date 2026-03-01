import React from 'react';
import { View, StyleSheet, Linking, Platform } from 'react-native';
import { Modal, Portal, Text, Button, Snackbar } from 'react-native-paper';
import { useUpdateStore } from '../store/updateStore';
import UpdateService from '../helper/UpdateService';

const UpdatePrompt = () => {
    const {
        isUpdateAvailable,
        isUpdateReady,
        forceUpdate,
        updateType,
        latestAppVersion,
        apkUrl,
        playStoreUrl,
        message,
    } = useUpdateStore();

    const handleUpdate = () => {
        if (updateType === 'PlayStore' && playStoreUrl) {
            Linking.openURL(playStoreUrl);
        } else if (updateType === 'APK' && apkUrl) {
            Linking.openURL(apkUrl);
        }
    };

    const handleRestart = () => {
        UpdateService.reloadApp();
    };

    // 1. Forced Update Modal
    const showModal = forceUpdate && isUpdateAvailable;

    // 2. OTA Ready Snackbar
    const showOtaReady = isUpdateReady && !forceUpdate;

    return (
        <>
            <Portal>
                <Modal
                    visible={showModal}
                    dismissable={false}
                    contentContainerStyle={styles.modalContainer}
                >
                    <Text style={styles.title}>Update Required</Text>
                    <Text style={styles.message}>
                        {message || `A new version (${latestAppVersion}) is required to continue using the app.`}
                    </Text>
                    <Button mode="contained" onPress={handleUpdate} style={styles.button}>
                        Update Now
                    </Button>
                </Modal>
            </Portal>

            <Snackbar
                visible={showOtaReady}
                onDismiss={() => { }}
                action={{
                    label: 'Restart',
                    onPress: handleRestart,
                }}
                duration={Snackbar.DURATION_MEDIUM}
            >
                A background update is ready.
            </Snackbar>
        </>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        backgroundColor: 'white',
        padding: 24,
        margin: 20,
        borderRadius: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#111827',
    },
    message: {
        fontSize: 16,
        marginBottom: 24,
        color: '#4B5563',
    },
    button: {
        marginTop: 8,
        backgroundColor: '#3b82f6',
    },
});

export default UpdatePrompt;
