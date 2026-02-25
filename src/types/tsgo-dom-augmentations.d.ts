// Temporary TypeScript Go preview workaround:
// `@typescript/native-preview` currently omits `ServiceWorkerRegistration.pushManager`
// in its bundled `lib.dom.d.ts` (verified on 7.0.0-dev.20260225.1).
// Remove this once upstream DOM lib parity is fixed.
interface ServiceWorkerRegistration {
  readonly pushManager: PushManager;
}
