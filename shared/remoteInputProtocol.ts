import * as v from "valibot"

const FiniteNumberSchema = v.pipe(v.number(), v.finite())

export const PeerVideoClickSchema = v.object({
  x: FiniteNumberSchema,
  y: FiniteNumberSchema,
  width: FiniteNumberSchema,
  height: FiniteNumberSchema,
  xRatio: FiniteNumberSchema,
  yRatio: FiniteNumberSchema,
  clickerViewportWidth: FiniteNumberSchema,
  clickerViewportHeight: FiniteNumberSchema,
  clickerScreenWidth: FiniteNumberSchema,
  clickerScreenHeight: FiniteNumberSchema,
  devicePixelRatio: FiniteNumberSchema,
})

export type PeerVideoClick = v.InferOutput<typeof PeerVideoClickSchema>

const RemoteClickRequestSchema = v.object({
  type: v.literal("remote-click"),
  click: PeerVideoClickSchema,
})

export type RemoteClickRequest = v.InferOutput<typeof RemoteClickRequestSchema>

export const RemoteInputMessageSchema = v.variant("type", [RemoteClickRequestSchema])

export type RemoteInputMessage = v.InferOutput<typeof RemoteInputMessageSchema>

export const ExtensionAckSchema = v.variant("ok", [
  v.object({
    ok: v.literal(true),
    type: v.literal("remote-click-applied"),
    targetTabId: FiniteNumberSchema,
  }),
  v.object({
    ok: v.literal(false),
    type: v.literal("remote-click-rejected"),
    reason: v.string(),
    stage: v.optional(v.string()),
  }),
])

export type ExtensionAck = v.InferOutput<typeof ExtensionAckSchema>

export function isPeerVideoClick(value: unknown): value is PeerVideoClick {
  return v.safeParse(PeerVideoClickSchema, value).success
}

export function isRemoteInputMessage(value: unknown): value is RemoteInputMessage {
  return v.safeParse(RemoteInputMessageSchema, value).success
}

export function isExtensionAck(value: unknown): value is ExtensionAck {
  return v.safeParse(ExtensionAckSchema, value).success
}
