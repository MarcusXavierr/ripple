import * as v from "valibot"
import { isPeerVideoClick, type PeerVideoClick } from "@shared/remoteInputProtocol"
import { executeRemoteClick, type ClickExecutionResult } from "./executeRemoteClick"
import { translateRemoteClick } from "./translateRemoteClick"

const PeerVideoClickSchema = v.custom<PeerVideoClick>(isPeerVideoClick)

export const ExecuteRemoteClickMessageSchema = v.object({
  type: v.literal("execute-remote-click"),
  click: PeerVideoClickSchema,
})

export type ExecuteRemoteClickMessage = v.InferOutput<typeof ExecuteRemoteClickMessageSchema>

export const ContentMessageSchema = v.variant("type", [ExecuteRemoteClickMessageSchema])

export type ContentMessage = v.InferOutput<typeof ContentMessageSchema>

export type ContentMessageResult = ClickExecutionResult | { ok: false; reason: string; stage: "message" }

type ContentHandlerDeps = {
  viewport: { width: number; height: number }
  execute: (point: { x: number; y: number }) => ClickExecutionResult
}

export function handleContentMessage(message: unknown, deps: ContentHandlerDeps): ContentMessageResult {
  const parsed = v.safeParse(ContentMessageSchema, message)
  if (!parsed.success) {
    return { ok: false, reason: "unknown content message", stage: "message" }
  }

  const point = translateRemoteClick(parsed.output.click, deps.viewport)
  return deps.execute(point)
}

export function createContentMessageDeps(doc: Document = document): ContentHandlerDeps {
  return {
    viewport: {
      width: doc.defaultView?.innerWidth ?? doc.documentElement.clientWidth,
      height: doc.defaultView?.innerHeight ?? doc.documentElement.clientHeight,
    },
    execute: (point) => executeRemoteClick(point, doc),
  }
}
