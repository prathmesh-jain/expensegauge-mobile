const fs = require("fs");
const path = require("path");

// Firebase config for push notifications (FCM).
// On EAS this comes from the GOOGLE_SERVICES_JSON file environment variable;
// locally it falls back to ./google-services.json when that file exists.
function resolveGoogleServicesFile() {
  if (process.env.GOOGLE_SERVICES_JSON) return process.env.GOOGLE_SERVICES_JSON;
  const localFile = "./google-services.json";
  return fs.existsSync(path.join(__dirname, localFile)) ? localFile : undefined;
}

export default ({ config }) => {
  const variant = process.env.APP_VARIANT ?? "production";
  const isDevelopment = variant === "development";
  const googleServicesFile = resolveGoogleServicesFile();

  return {
    ...config,
    name: isDevelopment ? "ExpenseGauge Dev" : "ExpenseGauge",
    android: {
      ...config.android,
      package: isDevelopment
        ? "com.expensegauge.dev"
        : "com.expensegauge",
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
