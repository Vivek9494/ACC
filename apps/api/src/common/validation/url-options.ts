/** Accept localhost and LAN IPs in development (Expo Go, simulators). */
export const APP_URL_VALIDATION_OPTIONS = {
  require_tld: false,
  protocols: ['http', 'https'],
};
