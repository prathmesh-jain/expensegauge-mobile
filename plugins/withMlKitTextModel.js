const { AndroidConfig, withAndroidManifest } = require("@expo/config-plugins");

const META_NAME = "com.google.mlkit.vision.DEPENDENCIES";

// expo-text-extractor uses ML Kit's text model from Google Play services, which
// is otherwise downloaded the first time someone scans. This asks Play services
// to fetch it when the app is installed, so the first scan works straight away
// (and offline).
//
// The dev client (expo-dev-launcher, debug builds only) declares the same entry
// with "barcode_ui" for its QR scanner. Android allows one value, so development
// builds list both models and replace the dev launcher's entry; release builds
// don't include the dev launcher and only need "ocr".
module.exports = function withMlKitTextModel(config) {
  const isDevelopment = process.env.APP_VARIANT === "development";
  const value = isDevelopment ? "barcode_ui,ocr" : "ocr";

  return withAndroidManifest(config, (config) => {
    const manifest = AndroidConfig.Manifest.ensureToolsAvailable(config.modResults);
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(application, META_NAME, value);

    // Our value wins if a library declares the same entry
    const item = application["meta-data"].find((m) => m.$["android:name"] === META_NAME);
    item.$["tools:replace"] = "android:value";

    config.modResults = manifest;
    return config;
  });
};
