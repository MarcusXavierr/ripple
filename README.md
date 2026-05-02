# Ripple

### Stop explaining where to click. Just click it yourself.

Video calls where you share your screen and the other person can actually click and type on it. No TeamViewer install. No more "no, up a bit, no, the *other* button, yeah, now click."

---

## Why "Ripple"?

You touch the water and the wave spreads. That's the idea. They tap their screen, the click lands on yours.

---

## What it does

- One-on-one video calls, in the browser.
- Screen sharing.
- Hands the click and the keyboard to the other person when you want, and only when you want.
- Goes directly between the two computers. Your video doesn't go through a server of ours.

---

## Who it's for

- People doing tech support for their parents.
- Pair programming, design reviews, onboarding someone who just joined.
- Teachers and students who need to *do* the thing together, not just point at it.
- Anyone tired of saying "no, more to the right."

---

## They control the tab. Not your computer.

When you share a tab in Ripple, the extension only lets the other person click and type *inside that tab*. They can't switch to your email, peek at other windows, mess with your files, or move your mouse around the desktop. Close the tab, and they're out.

It's the opposite trade from TeamViewer. There you hand over the whole machine and trust the person on the other end. Here you hand over one tab, and that's the ceiling.

---

## How it works

1. Open a room. You get a link.
2. Send the link to the other person.
3. Share your screen, then open the Ripple extension and pick which tab they're allowed to click on. That tab, and only that tab.

For any of this to work, you install the Chrome extension once. After that, sharing a tab is two clicks: pick the tab, hand it over.

---

## Stack (for devs)

- React 19 + Vite + TypeScript on the front
- WebRTC for video, audio, and the data channel
- Chrome extension (WXT) that turns remote clicks into synthetic events on the chosen tab
- Separate signaling backend

---

## Running it locally

Web app, from the repo root:

```bash
bun install
bun run dev
```

Extension, from `extension/`:

```bash
bun install
bun run dev
```

You'll need a signaling backend running and `VITE_WS_URL` pointed at it.

