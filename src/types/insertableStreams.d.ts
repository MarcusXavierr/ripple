interface MediaStreamTrackProcessorInit {
  track: MediaStreamTrack
  maxBufferSize?: number
}

declare class MediaStreamTrackProcessor {
  constructor(init: MediaStreamTrackProcessorInit)
  readonly readable: ReadableStream<VideoFrame>
}

declare class MediaStreamTrackGenerator extends MediaStreamTrack {
  constructor(init: { kind: "video" })
  readonly writable: WritableStream<VideoFrame>
}
