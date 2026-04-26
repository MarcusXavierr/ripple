import * as v from "valibot"

const FiniteNumberSchema = v.pipe(v.number(), v.finite())
const DeltaModeSchema = v.union([v.literal(0), v.literal(1), v.literal(2)])

const PeerVideoEventLocationEntries = {
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
}

export const PeerVideoEventLocationSchema = v.object(PeerVideoEventLocationEntries)

export type PeerVideoEventLocation = v.InferOutput<typeof PeerVideoEventLocationSchema>

export const PeerVideoClickSchema = PeerVideoEventLocationSchema

export type PeerVideoClick = v.InferOutput<typeof PeerVideoClickSchema>

export const PeerVideoScrollSchema = v.object({
  ...PeerVideoEventLocationEntries,
  deltaX: FiniteNumberSchema,
  deltaY: FiniteNumberSchema,
  deltaMode: DeltaModeSchema,
})

export type PeerVideoScroll = v.InferOutput<typeof PeerVideoScrollSchema>

const RemoteClickRequestSchema = v.object({
  type: v.literal("remote-click"),
  click: PeerVideoClickSchema,
})

const RemoteScrollRequestSchema = v.object({
  type: v.literal("remote-scroll"),
  scroll: PeerVideoScrollSchema,
})

export type RemoteClickRequest = v.InferOutput<typeof RemoteClickRequestSchema>
export type RemoteScrollRequest = v.InferOutput<typeof RemoteScrollRequestSchema>

export const RemoteInputMessageSchema = v.variant("type", [
  RemoteClickRequestSchema,
  RemoteScrollRequestSchema,
])

export type RemoteInputMessage = v.InferOutput<typeof RemoteInputMessageSchema>

export const ExtensionAckSchema = v.variant("ok", [
  v.object({
    ok: v.literal(true),
    type: v.union([v.literal("remote-click-applied"), v.literal("remote-scroll-applied")]),
    targetTabId: FiniteNumberSchema,
  }),
  v.object({
    ok: v.literal(false),
    type: v.union([v.literal("remote-click-rejected"), v.literal("remote-scroll-rejected")]),
    reason: v.string(),
    stage: v.optional(v.string()),
  }),
])

export type ExtensionAck = v.InferOutput<typeof ExtensionAckSchema>

export function isPeerVideoClick(value: unknown): value is PeerVideoClick {
  return v.safeParse(PeerVideoClickSchema, value).success
}

export function isPeerVideoScroll(value: unknown): value is PeerVideoScroll {
  return v.safeParse(PeerVideoScrollSchema, value).success
}

export function isRemoteInputMessage(value: unknown): value is RemoteInputMessage {
  return v.safeParse(RemoteInputMessageSchema, value).success
}

export function isExtensionAck(value: unknown): value is ExtensionAck {
  return v.safeParse(ExtensionAckSchema, value).success
}
