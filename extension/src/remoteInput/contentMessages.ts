import * as v from "valibot"
import {
  isPeerKeyboardInput,
  isPeerVideoClick,
  isPeerVideoScroll,
  type PeerKeyboardInput,
  type PeerVideoClick,
  type PeerVideoScroll,
} from "@shared/remoteInputProtocol"
import { executeRemoteClick, type ClickExecutionResult } from "./executeRemoteClick"
import { executeRemoteKeyboard, type KeyboardExecutionResult } from "./executeRemoteKeyboard"
import { executeRemoteScroll, type ScrollExecutionResult } from "./executeRemoteScroll"
import { translateRemoteClick } from "./translateRemoteClick"
import { translateRemotePoint, type ViewportPoint } from "./translateRemotePoint"

const PeerVideoClickSchema = v.custom<PeerVideoClick>(isPeerVideoClick)
const PeerVideoScrollSchema = v.custom<PeerVideoScroll>(isPeerVideoScroll)
const PeerKeyboardInputSchema = v.custom<PeerKeyboardInput>(isPeerKeyboardInput)

export const ExecuteRemoteClickMessageSchema = v.object({
  type: v.literal("execute-remote-click"),
  click: PeerVideoClickSchema,
})

export type ExecuteRemoteClickMessage = v.InferOutput<typeof ExecuteRemoteClickMessageSchema>

export const ExecuteRemoteScrollMessageSchema = v.object({
  type: v.literal("execute-remote-scroll"),
  scroll: PeerVideoScrollSchema,
})

export const ExecuteRemoteKeyboardMessageSchema = v.object({
  type: v.literal("execute-remote-keyboard"),
  keyboard: PeerKeyboardInputSchema,
})

export const ContentMessageSchema = v.variant("type", [
  ExecuteRemoteClickMessageSchema,
  ExecuteRemoteScrollMessageSchema,
  ExecuteRemoteKeyboardMessageSchema,
])

export type ContentMessage = v.InferOutput<typeof ContentMessageSchema>

export type ContentMessageResult =
  | ClickExecutionResult
  | ScrollExecutionResult
  | KeyboardExecutionResult
  | { ok: false; reason: string; stage: "message" }

type ContentHandlerDeps = {
  viewport: { width: number; height: number }
  execute: (point: ViewportPoint) => ClickExecutionResult
  executeScroll: (point: ViewportPoint, scroll: PeerVideoScroll) => ScrollExecutionResult
  executeKeyboard: (keyboard: PeerKeyboardInput) => KeyboardExecutionResult
}

export function handleContentMessage(
  message: unknown,
  deps: ContentHandlerDeps
): ContentMessageResult {
  const parsed = v.safeParse(ContentMessageSchema, message)
  if (!parsed.success) {
    return { ok: false, reason: "unknown content message", stage: "message" }
  }

  if (parsed.output.type === "execute-remote-click") {
    const point = translateRemoteClick(parsed.output.click, deps.viewport)
    return deps.execute(point)
  }

  if (parsed.output.type === "execute-remote-keyboard") {
    return deps.executeKeyboard(parsed.output.keyboard)
  }

  const point = translateRemotePoint(parsed.output.scroll, deps.viewport)
  return deps.executeScroll(point, parsed.output.scroll)
}

export function createContentMessageDeps(doc: Document = document): ContentHandlerDeps {
  return {
    viewport: {
      width: doc.defaultView?.innerWidth ?? doc.documentElement.clientWidth,
      height: doc.defaultView?.innerHeight ?? doc.documentElement.clientHeight,
    },
    execute: (point) => executeRemoteClick(point, doc),
    executeScroll: (point, scroll) => executeRemoteScroll(point, scroll, doc),
    executeKeyboard: (keyboard) => executeRemoteKeyboard(keyboard, doc),
  }
}
