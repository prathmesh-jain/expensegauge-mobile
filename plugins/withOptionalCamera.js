
const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withOptionalCamera(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    const features = manifest["uses-feature"] ?? [];

    const optionalFeatures = [
      "android.hardware.camera",
      "android.hardware.camera.autofocus",
    ];

    for (const featureName of optionalFeatures) {
      const existing = features.find(
        (feature) => feature.$["android:name"] === featureName
      );

      if (existing) {
        existing.$["android:required"] = "false";
      } else {
        features.push({
          $: {
            "android:name": featureName,
            "android:required": "false",
          },
        });
      }
    }

    manifest["uses-feature"] = features;

    return config;
  });
};
