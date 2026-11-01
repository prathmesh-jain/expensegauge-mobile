
export default ({ config }) => {
  const variant = process.env.APP_VARIANT ?? "production";
  const isDevelopment = variant === "development";

  return {
    ...config,
    name: isDevelopment ? "ExpenseGauge Dev" : "ExpenseGauge",
    android: {
      ...config.android,
      package: isDevelopment
        ? "com.expensegauge.dev"
        : "com.expensegauge",
    },
  };
};
