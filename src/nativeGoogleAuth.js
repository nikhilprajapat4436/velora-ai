import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";

const webClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  || "30640422083-i8htrvkvjgjq26nlo3ecb950ohdt5em9.apps.googleusercontent.com";

let initialization;

export async function getNativeGoogleCredential() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Native Google Sign-In is only available inside the mobile app.");
  }

  initialization ||= SocialLogin.initialize({ google: { webClientId } });
  await initialization;

  const response = await SocialLogin.login({
    provider: "google",
    options: { scopes: ["email", "profile"] },
  });

  const credential = response.result?.idToken;
  if (!credential) throw new Error("Google did not return an ID token.");
  return credential;
}
