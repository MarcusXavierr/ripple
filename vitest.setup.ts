import { vi } from "vitest"
import "@testing-library/jest-dom"
import "./src/i18n"

const HTMLDivElementConstructor = (globalThis as { HTMLDivElement?: { prototype: object } })
  .HTMLDivElement

if (HTMLDivElementConstructor) {
  Object.defineProperty(HTMLDivElementConstructor.prototype, "setPointerCapture", {
    value: vi.fn(),
    configurable: true,
  })

  Object.defineProperty(HTMLDivElementConstructor.prototype, "hasPointerCapture", {
    value: vi.fn(() => true),
    configurable: true,
  })

  Object.defineProperty(HTMLDivElementConstructor.prototype, "releasePointerCapture", {
    value: vi.fn(),
    configurable: true,
  })
}
