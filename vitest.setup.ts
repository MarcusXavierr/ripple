import { vi } from "vitest"
import "@testing-library/jest-dom"
import "./src/i18n"

if (typeof HTMLDivElement !== "undefined") {
  Object.defineProperty(HTMLDivElement.prototype, "setPointerCapture", {
    value: vi.fn(),
    configurable: true,
  })

  Object.defineProperty(HTMLDivElement.prototype, "hasPointerCapture", {
    value: vi.fn(() => true),
    configurable: true,
  })

  Object.defineProperty(HTMLDivElement.prototype, "releasePointerCapture", {
    value: vi.fn(),
    configurable: true,
  })
}
