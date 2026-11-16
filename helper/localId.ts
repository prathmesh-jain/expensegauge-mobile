// Id made on the phone, sent as `clientId` so the server can ignore retries of the same request
export const createLocalId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
