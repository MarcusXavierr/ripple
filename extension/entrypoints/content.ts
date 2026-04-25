import { browser } from "wxt/browser"
import { createContentMessageDeps, handleContentMessage } from "../src/remoteInput/contentMessages"

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  allFrames: true,
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const result = handleContentMessage(message, createContentMessageDeps())
      sendResponse(result)
      return false
    })
  },
})
