// Talking to the little Mac menu-bar app (see mac/). The Mac app shows this website at
// /?popup=1 inside a floating window when you press ⌥Space.

/** True when the page was opened as the quick-add popup. */
export const isPopup = new URLSearchParams(window.location.search).has('popup')

type NativeMessage = { type: 'close' } | { type: 'openApp' }

interface MacBridge {
  webkit?: { messageHandlers?: { taskCapture?: { postMessage: (message: NativeMessage) => void } } }
}

/** True when running inside the Mac app (not a normal browser tab). */
export const inMacApp = Boolean((window as MacBridge).webkit?.messageHandlers?.taskCapture)

/** Ask the Mac app to do something. Does nothing in a normal browser. */
export function tellMac(message: NativeMessage) {
  ;(window as MacBridge).webkit?.messageHandlers?.taskCapture?.postMessage(message)
}
