import * as v from "valibot"
import {
  isPeerVideoClick,
  isPeerVideoScroll,
  type PeerVideoClick,
  type PeerVideoScroll,
} from "@shared/remoteInputProtocol"
import { executeRemoteClick, type ClickExecutionResult } from "./executeRemoteClick"
import { executeRemoteScroll, type ScrollExecutionResult } from "./executeRemoteScroll"
import { translateRemoteClick } from "./translateRemoteClick"
import { translateRemotePoint, type ViewportPoint } from "./translateRemotePoint"

const PeerVideoClickSchema = v.custom<PeerVideoClick>(isPeerVideoClick)
const PeerVideoScrollSchema = v.custom<PeerVideoScroll>(isPeerVideoScroll)

export const ExecuteRemoteClickMessageSchema = v.object({
  type: v.literal("execute-remote-click"),
  click: PeerVideoClickSchema,
})

export type ExecuteRemoteClickMessage = v.InferOutput<typeof ExecuteRemoteClickMessageSchema>

export const ExecuteRemoteScrollMessageSchema = v.object({
  type: v.literal("execute-remote-scroll"),
  scroll: PeerVideoScrollSchema,
})

export const ContentMessageSchema = v.variant("type", [
  ExecuteRemoteClickMessageSchema,
  ExecuteRemoteScrollMessageSchema,
])

export type ContentMessage = v.InferOutput<typeof ContentMessageSchema>

export type ContentMessageResult =
  | ClickExecutionResult
  | ScrollExecutionResult
  | { ok: false; reason: string; stage: "message" }

type ContentHandlerDeps = {
  viewport: { width: number; height: number }
  execute: (point: ViewportPoint) => ClickExecutionResult
  executeScroll: (point: ViewportPoint, scroll: PeerVideoScroll) => ScrollExecutionResult
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
  }
}
