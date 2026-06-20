/** Injection token for the active {@link SmsProvider} implementation. */
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

/**
 * Provider-agnostic OTP SMS gateway. Twilio (stack §29) is the production
 * adapter; a dev stub logs codes locally without sending.
 */
export interface SmsProvider {
  /** Deliver a one-time password to an E.164 mobile number (+1XXXXXXXXXX). */
  sendOtp(e164Number: string, code: string): Promise<void>;
}

/** @deprecated Use {@link SMS_PROVIDER} and {@link SmsProvider}. */
export const SMS_SENDER = SMS_PROVIDER;

/** @deprecated Use {@link SmsProvider}. */
export type SmsSender = {
  sendSms(to: string, body: string): Promise<void>;
};
