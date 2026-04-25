import { isPeerVideoClick, type PeerVideoClick } from "@shared/remoteInputProtocol"
import { executeRemoteClick, type ClickExecutionResult } from "./executeRemoteClick"
import { translateRemoteClick } from "./translateRemoteClick"

export type ExecuteRemoteClickMessage = {
  type: "execute-remote-click"
  click: PeerVideoClick
}

export type ContentMessage = ExecuteRemoteClickMessage

export type ContentMessageResult =
  | ClickExecutionResult
  | { ok: false; reason: string; stage: "message" }

type ContentHandlerDeps = {
  viewport: { width: number; height: number }
  execute: (point: { x: number; y: number }) => ClickExecutionResult
}

// TODO: [Refactor] Isso aqui pode evoluir pra alguma validação tipo zod, e talvez validar uma lista de tipos, pq logo logo vou adicionar mais tipos de eventos heheh
export function handleContentMessage(message: unknown, deps: ContentHandlerDeps): ContentMessageResult {
  if (!isExecuteRemoteClickMessage(message)) {
    return { ok: false, reason: "unknown content message", stage: "message" }
  }

  const point = translateRemoteClick(message.click, deps.viewport)
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

function isExecuteRemoteClickMessage(value: unknown): value is ExecuteRemoteClickMessage {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  return record.type === "execute-remote-click" && isPeerVideoClick(record.click)
}
