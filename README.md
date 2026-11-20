# balla
a Facebook-like Bluesky client

Balla (`balla`, Gàidhlig for **wall**) is a Facebook-style client for Bluesky and the AT Protocol: your friends' posts as cards on a home feed, newest first, with no algorithm deciding what you see.

## Status

Early scaffold: Expo + React Native + TypeScript, app-password login, the chronological Following feed rendered as cards, notifications, and your profile. Threads, images viewer and DMs are on the roadmap.

## Getting started

Requires Node 22+ (see the Expo SDK 58 engines field) and an Expo-friendly environment.

    npm install
    python3 scripts/gen-icons.py   # one-time: generates the placeholder app icons, stdlib only
    npx expo start

Then scan the QR code with Expo Go on your phone. If dependency versions have drifted since this scaffold was written, run `npx expo install --check` once after the first install.

## Logging in (app passwords)

Balla logs in with an **app password**, never your main password. Create one in Bluesky under **Settings, Privacy and security, App passwords**. The default service is `https://bsky.social`; if your account signed up through another provider, enter that service host instead.

## Principles (Facebook UX minus the dark patterns)

- The chronological Following feed is the home feed. Always.
- No engagement ranking, no ads, no suggested posts, no upsells.
- Every action is a visible, comfortably-sized button. Nothing is hidden behind swipes or long-presses.
- Honest timestamps.

## Roadmap

- [ ] Threads and inline comments
- [ ] ATProto OAuth (`@atproto/oauth-client-expo`), with client metadata hosted at balla.croft.click
- [ ] Full-screen image viewer
- [ ] DMs (chat)
- [ ] A web build (react-native-web) served at balla.croft.click from this same codebase

## License

AGPL-3.0. See [LICENSE](LICENSE).
