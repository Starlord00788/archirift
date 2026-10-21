/**
 * Firebase settings come from public environment variables at build time. When they are missing
 * (local development, forks, tests) accounts are simply turned off and everything stays on-device.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * reCAPTCHA v3 site key for Firebase App Check. When set, every Firebase request carries proof that
 * it came from this site, so scripts using the public config are refused once App Check is enforced.
 */
export const appCheckSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export const cloudConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
