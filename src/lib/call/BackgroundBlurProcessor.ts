import type { ImageSegmenter } from "@mediapipe/tasks-vision"
import type { BackgroundBlurLevel } from "@/store/call"

export type ActiveBlurLevel = Exclude<BackgroundBlurLevel, "off">

// TODO: [Refactor] self-host dos assets do MediaPipe — ver TODOS.md #12
const MEDIAPIPE_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
const SEGMENTER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite"
const SEGMENTATION_WIDTH = 256
const BLUR_RADIUS_RATIO: Record<ActiveBlurLevel, number> = { light: 0.01, strong: 0.025 }
const MASK_FEATHER_RATIO = 0.004

let segmenterPromise: Promise<ImageSegmenter> | null = null
let lastSegmentationTimestamp = 0

function loadSegmenter(): Promise<ImageSegmenter> {
  segmenterPromise ??= (async () => {
    // Loaded only on activation: a static import would ship MediaPipe in every call's initial bundle.
    const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision")
    const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL)
    return ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: SEGMENTER_MODEL_URL, delegate: "CPU" },
      runningMode: "VIDEO",
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    })
  })().catch((err) => {
    segmenterPromise = null
    throw err
  })
  return segmenterPromise
}

function nextSegmentationTimestamp(): number {
  lastSegmentationTimestamp = Math.max(performance.now(), lastSegmentationTimestamp + 1)
  return lastSegmentationTimestamp
}

export function isBackgroundBlurSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "MediaStreamTrackProcessor" in window &&
    "MediaStreamTrackGenerator" in window &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof VideoFrame !== "undefined"
  )
}

export class BackgroundBlurProcessor {
  readonly track: MediaStreamTrack
  level: ActiveBlurLevel

  private readonly source: MediaStreamTrack
  private readonly segmenter: ImageSegmenter
  private readonly abort = new AbortController()
  private readonly output = new OffscreenCanvas(1, 1)
  private readonly segInput = new OffscreenCanvas(1, 1)
  private readonly mask = new OffscreenCanvas(1, 1)
  private readonly outCtx: OffscreenCanvasRenderingContext2D
  private readonly segCtx: OffscreenCanvasRenderingContext2D
  private readonly maskCtx: OffscreenCanvasRenderingContext2D
  private maskImage: ImageData | null = null
  private loggedError = false

  // `onFailure` fires if frame processing dies on its own; the output track then freezes.
  static async create(
    camera: MediaStreamTrack,
    level: ActiveBlurLevel,
    onFailure: (broken: BackgroundBlurProcessor) => void
  ): Promise<BackgroundBlurProcessor> {
    const segmenter = await loadSegmenter()
    return new BackgroundBlurProcessor(camera, level, segmenter, onFailure)
  }

  private constructor(
    camera: MediaStreamTrack,
    level: ActiveBlurLevel,
    segmenter: ImageSegmenter,
    onFailure: (broken: BackgroundBlurProcessor) => void
  ) {
    this.source = camera.clone()
    this.level = level
    this.segmenter = segmenter
    const generator = new MediaStreamTrackGenerator({ kind: "video" })
    this.track = generator

    const outCtx = this.output.getContext("2d")
    const segCtx = this.segInput.getContext("2d")
    const maskCtx = this.mask.getContext("2d")
    if (!outCtx || !segCtx || !maskCtx) {
      this.source.stop()
      generator.stop()
      throw new Error("[BackgroundBlur] 2D context unavailable")
    }
    this.outCtx = outCtx
    this.segCtx = segCtx
    this.maskCtx = maskCtx

    new MediaStreamTrackProcessor({ track: this.source }).readable
      .pipeThrough(
        new TransformStream<VideoFrame, VideoFrame>({
          transform: (frame, controller) => this.transform(frame, controller),
        }),
        { signal: this.abort.signal }
      )
      .pipeTo(generator.writable, { signal: this.abort.signal })
      .catch((err: unknown) => {
        if (this.abort.signal.aborted) return // stop() cancels the pipeline on purpose
        console.error("[BackgroundBlur] frame processing stopped", err)
        onFailure(this)
      })
  }

  setEnabled(enabled: boolean): void {
    this.source.enabled = enabled
    this.track.enabled = enabled
  }

  stop(): void {
    this.abort.abort()
    this.source.stop()
    this.track.stop()
  }

  private transform(
    frame: VideoFrame,
    controller: TransformStreamDefaultController<VideoFrame>
  ): void {
    try {
      const width = frame.displayWidth
      const height = frame.displayHeight
      const segWidth = SEGMENTATION_WIDTH
      const segHeight = Math.max(1, Math.round((segWidth * height) / width))
      if (this.output.width !== width || this.output.height !== height) {
        this.output.width = width
        this.output.height = height
      }
      if (this.segInput.width !== segWidth || this.segInput.height !== segHeight) {
        this.segInput.width = segWidth
        this.segInput.height = segHeight
      }
      this.segCtx.drawImage(frame, 0, 0, segWidth, segHeight)

      let hasMask = false
      try {
        this.segmenter.segmentForVideo(this.segInput, nextSegmentationTimestamp(), (result) => {
          const masks = result.confidenceMasks
          const person = masks?.[masks.length - 1]
          if (!person) return
          if (this.mask.width !== person.width || this.mask.height !== person.height) {
            this.mask.width = person.width
            this.mask.height = person.height
            this.maskImage = new ImageData(person.width, person.height)
          }
          const image = this.maskImage
          if (!image) return
          const confidence = person.getAsFloat32Array()
          const data = image.data
          for (let i = 0; i < confidence.length; i++) {
            data[i * 4 + 3] = confidence[i] * 255
          }
          this.maskCtx.putImageData(image, 0, 0)
          hasMask = true
        })
      } catch (err) {
        if (!this.loggedError) {
          console.error("[BackgroundBlur] segmentation failed", err)
          this.loggedError = true
        }
      }

      const radius = Math.round(width * BLUR_RADIUS_RATIO[this.level])
      const feather = Math.max(1, Math.round(width * MASK_FEATHER_RATIO))
      if (hasMask) {
        this.outCtx.globalCompositeOperation = "copy"
        this.outCtx.filter = `blur(${feather}px)`
        this.outCtx.drawImage(this.mask, 0, 0, width, height)
        this.outCtx.globalCompositeOperation = "source-in"
        this.outCtx.filter = "none"
        this.outCtx.drawImage(frame, 0, 0, width, height)
        this.outCtx.globalCompositeOperation = "destination-over"
      } else {
        // Never send a sharp background when segmentation fails.
        this.outCtx.globalCompositeOperation = "copy"
      }
      this.outCtx.filter = `blur(${radius}px)`
      this.outCtx.drawImage(
        frame,
        -2 * radius,
        -2 * radius,
        width + 4 * radius,
        height + 4 * radius
      )
      this.outCtx.globalCompositeOperation = "source-over"
      this.outCtx.filter = "none"

      controller.enqueue(new VideoFrame(this.output, { timestamp: frame.timestamp }))
    } finally {
      frame.close()
    }
  }
}
