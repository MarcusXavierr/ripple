// src/hooks/useWebRTC.ts
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCallStore } from '@/store/call'
import { getPeerId } from '@/lib/peerId'
import { CLOSE_CODES } from '@/types/signaling'
import type { ClientMessage, ReceivedMessage } from '@/types/signaling'

const WS_URL = import.meta.env.VITE_WS_URL as string
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]
const MAX_WS_ATTEMPTS = 3

export function useWebRTC(roomId: string) {
  const navigate = useNavigate()

  const wsRef = useRef<WebSocket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([])
  const remoteDescriptionSet = useRef(false)
  const makingOffer = useRef(false)
  const isPoliteRef = useRef(false)
  const reconnectDelay = useRef(1000)
  const wsAttempts = useRef(0)
  const isMounted = useRef(true)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peerIdRef = useRef('')

  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)

  const { localStream, remoteStream, status, error, isScreenSharing } = useCallStore()

  function send(msg: ClientMessage) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }

  async function drainCandidates() {
    const pc = pcRef.current
    if (!pc) return
    for (const c of pendingCandidates.current) {
      await pc.addIceCandidate(c)
    }
    pendingCandidates.current = []
  }

  function setupPeerConnection(role: 'caller' | 'callee') {
    remoteDescriptionSet.current = false
    pendingCandidates.current = []
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pcRef.current = pc
    useCallStore.setState({ pc, role })

    const stream = useCallStore.getState().localStream
    if (stream) {
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream)
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send({ type: 'ice-candidate', candidate: e.candidate.toJSON() })
      }
    }

    pc.ontrack = (e) => {
      useCallStore.setState({ remoteStream: e.streams[0] ?? null })
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        useCallStore.setState({ status: 'connected' })
      } else if (pc.iceConnectionState === 'failed') {
        useCallStore.setState({ status: 'reconnecting' })
        if (role === 'caller') pc.restartIce()
      }
    }

    isPoliteRef.current = role === 'callee'

    pc.onnegotiationneeded = async () => {
      try {
        makingOffer.current = true
        await pc.setLocalDescription()
        send({ type: 'offer', offer: pc.localDescription! })
      } finally {
        makingOffer.current = false
      }
    }
  }

  async function handleOffer(offer: RTCSessionDescriptionInit) {
    const pc = pcRef.current
    if (!pc) return
    const collision = makingOffer.current || pc.signalingState !== 'stable'
    if (!isPoliteRef.current && collision) return
    await pc.setRemoteDescription(offer)
    remoteDescriptionSet.current = true
    await drainCandidates()
    await pc.setLocalDescription()
    send({ type: 'answer', answer: pc.localDescription! })
  }

  async function handleAnswer(answer: RTCSessionDescriptionInit) {
    const pc = pcRef.current
    if (!pc) return
    await pc.setRemoteDescription(answer)
    remoteDescriptionSet.current = true
    await drainCandidates()
  }

  async function handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (remoteDescriptionSet.current && pcRef.current) {
      await pcRef.current.addIceCandidate(candidate)
    } else {
      pendingCandidates.current.push(candidate)
    }
  }

  function scheduleReconnect() {
    wsAttempts.current++
    if (wsAttempts.current >= MAX_WS_ATTEMPTS) {
      useCallStore.setState({ error: 'Unable to connect to the server.' })
      return
    }
    useCallStore.setState({ status: 'reconnecting' })
    reconnectTimer.current = setTimeout(() => {
      if (isMounted.current) connectWS()
    }, reconnectDelay.current)
    reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30_000)
  }

  function connectWS() {
    const url = `${WS_URL}?room=${roomId}&peerId=${peerIdRef.current}`
    const ws = new WebSocket(url)
    wsRef.current = ws
    useCallStore.setState({ ws, status: 'connecting' })

    ws.onopen = () => {
      reconnectDelay.current = 1000
      wsAttempts.current = 0
    }

    const MESSAGE_HANDLERS: Record<string, (msg: any) => void | Promise<void>> = {
      'onopen': (msg) => {
        setupPeerConnection(msg.role)
        useCallStore.setState({ status: 'waiting' })
      },
      'enter': async () => {
        useCallStore.setState({ status: 'negotiating' })
        const pc = pcRef.current
        if (pc && useCallStore.getState().role === 'caller') {
          if (pc.signalingState !== 'stable') {
            await pc.setLocalDescription({ type: 'rollback' })
          }
          pc.restartIce()
        }
      },
      'peer-reconnected': () => {
        useCallStore.setState({ status: 'negotiating' })
        if (useCallStore.getState().role === 'caller') pcRef.current?.restartIce()
      },
      'ping': () => send({ type: 'pong' }),
      'offer': (msg) => handleOffer(msg.offer),
      'answer': (msg) => handleAnswer(msg.answer),
      'ice-candidate': (msg) => handleIceCandidate(msg.candidate),
    }

    ws.onmessage = async (e: MessageEvent<string>) => {
      const msg = JSON.parse(e.data) as ReceivedMessage
      const handler = MESSAGE_HANDLERS[msg.type]
      if (handler) await handler(msg)
    }

    const CLOSE_HANDLERS: Record<number, () => void> = {
      [CLOSE_CODES.ROOM_FULL]: () => useCallStore.setState({ error: 'This room is full. Only two participants are allowed.' }),
      [CLOSE_CODES.PEER_DISCONNECTED]: () => navigate(`/room/${roomId}/ended`),
      [CLOSE_CODES.ROOM_NOT_FOUND]: () => useCallStore.setState({ error: "This room doesn't exist." }),
      [CLOSE_CODES.DUPLICATE_SESSION]: () => useCallStore.setState({ error: "You're connected to this room from another tab." }),
    }

    ws.onclose = (e: CloseEvent) => {
      if (e.code === 1000) return
      const handler = CLOSE_HANDLERS[e.code]
      if (handler) {
        handler()
      } else {
        scheduleReconnect()
      }
    }
  }

  function dismissError() {
    const err = useCallStore.getState().error
    useCallStore.setState({ error: null })
    if (
      err?.includes('room is full') ||
      err?.includes("doesn't exist") ||
      err?.includes('another tab') ||
      err?.includes('Unable to connect')
    ) {
      navigate('/')
    }
  }

  async function startScreenShare() {
    const pc = pcRef.current
    if (!pc) return
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const screenTrack = screenStream.getVideoTracks()[0]
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) {
        await sender.replaceTrack(screenTrack)
      } else {
        pc.addTrack(screenTrack, screenStream)
      }
      useCallStore.setState({ isScreenSharing: true })
      screenTrack.onended = stopScreenShare
    } catch (e) {
      console.error('Failed to start screen share:', e)
      // User cancelled picker
    }
  }

  async function stopScreenShare() {
    const pc = pcRef.current
    if (!pc) return
    const cameraTrack = useCallStore.getState().localStream?.getVideoTracks()[0] ?? null
    const sender = pc.getSenders().find((s) => s.track?.kind === 'video')

    const screenTrack = sender?.track
    if (sender) await sender.replaceTrack(cameraTrack)

    if (screenTrack && screenTrack !== cameraTrack) {
      screenTrack.stop()
    }

    useCallStore.setState({ isScreenSharing: false })
  }

  function cleanupMedia() {
    const { localStream, remoteStream } = useCallStore.getState()
    localStream?.getTracks().forEach((track) => track.stop())
    remoteStream?.getTracks().forEach((track) => track.stop())
  }

  function hangup() {
    cleanupMedia()
    wsRef.current?.close(1000, 'hangup')
    pcRef.current?.close()
    navigate(`/room/${roomId}/ended`)
  }

  function toggleMic() {
    const track = useCallStore.getState().localStream?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setIsMicMuted(!track.enabled)
  }

  function toggleCamera() {
    const track = useCallStore.getState().localStream?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setIsCameraOff(!track.enabled)
  }

  useEffect(() => {
    isMounted.current = true
    const peerId = getPeerId(roomId)
    peerIdRef.current = peerId
    useCallStore.setState({ peerId })

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        useCallStore.setState({ localStream: stream as MediaStream })
        connectWS()
      })
      .catch(() => {
        useCallStore.setState({
          error: 'Camera and microphone access is required to join a call.',
        })
      })

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      isMounted.current = false
      cleanupMedia()
      wsRef.current?.close(1000, 'unmount')
      pcRef.current?.close()
      useCallStore.getState().reset()
    }
  }, [roomId])

  return {
    localStream,
    remoteStream,
    status,
    error,
    isScreenSharing,
    isMicMuted,
    isCameraOff,
    startScreenShare,
    stopScreenShare,
    hangup,
    toggleMic,
    toggleCamera,
    dismissError,
  }
}
