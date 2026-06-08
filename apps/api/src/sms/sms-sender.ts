/** Injection token for the active {@link SmsSender} implementation. */
export const SMS_SENDER = Symbol('SMS_SENDER');

/**
 * Provider-agnostic SMS gateway. Twilio (stack §29) is the production
 * implementation; a console logger stands in for local development.
 */
export interface SmsSender {
  sendSms(to: string, body: string): Promise<void>;
}
