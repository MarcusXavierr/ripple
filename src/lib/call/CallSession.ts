// src/lib/call/CallSession.ts
import { MediaController } from './MediaController'
import { useCallStore } from '@/store/call'
import { getPeerId } from '@/lib/peerId'
import { CLOSE_CODES } from '@/types/signaling'
import type { ClientMessage, ReceivedMessage } from '@/types/signaling'

type NavigateFn = (path: string) => void

const WS_URL = import.meta.env.VITE_WS_URL as string
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]
const MAX_WS_ATTEMPTS = 3

// ── CallSession ───────────────────────────────────────────────────────────────

export class CallSession {
  readonly roomId: string
  readonly media: MediaController
  private readonly navigate: NavigateFn

  private ws: WebSocket | null = null
  private pc: RTCPeerConnection | null = null

  private pendingCandidates: RTCIceCandidateInit[] = []
  private remoteDescriptionSet = false
  private makingOffer = false
  private role: 'caller' | 'callee' | null = null

  private wsAttempts = 0
  private reconnectDelay = 1000
  private reconnectTimer?: ReturnType<typeof setTimeout>
  private alive = true

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  constructor(roomId: string, navigate: NavigateFn) {
    this.roomId = roomId
    this.navigate = navigate
    this.media = new MediaController()
  }

  async start() {
    const peerId = getPeerId(this.roomId)
    useCallStore.setState({ peerId })
    try {
      const stream = await this.media.init()
      if (!this.alive) {
        this.media.teardown()
        return
      }
      useCallStore.setState({ localStream: stream as MediaStream })
      this.connectWS()
    } catch (e) {
      if (!this.alive) return
      console.error("[Media Devices] We can't get the stream", e)
      useCallStore.setState({ error: 'Camera and microphone access is required to join a call.' })
    }
  }

  teardown(reason: 'unmount' | 'hangup' = 'unmount') {
    this.alive = false
    if (this.reconnectTimer !== undefined) clearTimeout(this.reconnectTimer)
    const { remoteStream } = useCallStore.getState()
    remoteStream?.getTracks().forEach((t) => t.stop())
    this.media.teardown()
    this.ws?.close(1000, reason)
    this.pc?.close()
    useCallStore.getState().reset()
  }

  // ── WebSocket ───────────────────────────────────────────────────────────────

  // TODO: Cara, junto do handleMessage, esse método é um dos coraçÕes da sala né. É aqui que roda o "event loop" do websocket que faz tudo kkkkk
  private connectWS() {
    console.debug("[Websocket] We are connecting to the websocket")
    console.trace()
    const peerId = getPeerId(this.roomId)
    const url = `${WS_URL}?room=${this.roomId}&peerId=${peerId}`
    const ws = new WebSocket(url)
    this.ws = ws
    useCallStore.setState({ ws, status: 'connecting' })

    // TODO: Esses são todos os hooks de websocket que setamos?
    ws.onopen = () => {
      this.reconnectDelay = 1000
      this.wsAttempts = 0
    }

    ws.onmessage = async (e: MessageEvent<string>) => {
      // TODO: [Refactor] nós precisamos de uma lógica pra logar erro certinho quando nós não conseguimos parsear esse json aí
      const msg = JSON.parse(e.data) as ReceivedMessage
      await this.handleMessage(msg)
    }

    ws.onclose = (e: CloseEvent) => {
      console.debug("[Websocket] The websocket is closed", e.reason, e)
      if (e.code === 1000) return
      const handled = this.handleCloseCode(e.code)
      // TODO: [Refactor] tem um bug aqui. Se por exemplo eu tomo um erro de que a sala tá cheia, pq eu vou chamar o scheduleReconnect? Não rola pq eu troco de pág lá em cima né. mas msm assim tá errado essa lógica do !handled
      if (!handled) this.scheduleReconnect()
    }
  }

  private send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  private scheduleReconnect() {
    // TODO: [Refactor] Nós precisamos logar que estamos reconectando. de preferencia sabendo o motivo de tal
    this.wsAttempts++
    if (this.wsAttempts >= MAX_WS_ATTEMPTS) {
      console.error("We can't connect to the server")
      useCallStore.setState({ error: 'Unable to connect to the server.' })
      return
    }
    useCallStore.setState({ status: 'reconnecting' })
    this.reconnectTimer = setTimeout(() => {
      // INFO: Interessante, sem o limit lá em cima essa porra poderia virar uma recursão infinita
      if (this.alive) this.connectWS()
    }, this.reconnectDelay)
    // TODO: Nunca chega a 30s se o limite é 3x né. E porra, 30s é tempo pra caralho
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000)
  }

  private handleCloseCode(code: number): boolean {
    const handlers: Record<number, () => void> = {
      [CLOSE_CODES.ROOM_FULL]: () =>
        useCallStore.setState({ error: 'This room is full. Only two participants are allowed.' }),
      [CLOSE_CODES.PEER_DISCONNECTED]: () =>
        this.navigate(`/room/${this.roomId}/ended`),
      [CLOSE_CODES.ROOM_NOT_FOUND]: () =>
        useCallStore.setState({ error: "This room doesn't exist." }),
      [CLOSE_CODES.DUPLICATE_SESSION]: () =>
        useCallStore.setState({ error: "You're connected to this room from another tab." }),
    }
    // TODO: [Refactor] nós precisamos de uma lógica para botar uma mensagem padrão quando é um close code desconhecido. e precisamos logar isso no console tbm (ou no sentry, ainda não decidi como vou jogar os logs do client pra um agregador)
    const handler = handlers[code]
    if (handler) { handler(); return true }
    return false
  }

  // ── Signaling message dispatch ──────────────────────────────────────────────

  private async handleMessage(msg: ReceivedMessage) {
    // TODO: [Refactor] Essa porra de switch FEDE. Aqui tá basicamente o CORAÇÃO DA APLICAÇÃO. Poderia ter um módulo de handling de mensagens mais bem testado e mais bem documentado. porra, aqui tá uma mistura de webRTC com websocket (imagino que os métodos internos chamados aqui mexam com websocket). Sei lá, não tô gostando dessa mistura de funções puras e impuras. Lógica e IO juntos
    switch (msg.type) {
      case 'onopen':
        // INFO: cara, parece q um dos corações da sala vive aqui dentro hahaha, tanta coisa aninhada. eu acho que modulos mais flat são mais simples e faceis de entender e manter
        this.setupPC(msg.role)
        useCallStore.setState({ status: 'waiting' })
        break
      case 'enter':
        // TODO: [Refactor] Porra, gambiarra legal hein. pq eu preciso restartar o ice aqui? pra que botar em rollback se não é stable? essa parece ser a parte mais confusa do método até então
        useCallStore.setState({ status: 'negotiating' })
        if (this.role === 'caller' && this.pc) {
          if (this.pc.signalingState !== 'stable') {
            await this.pc.setLocalDescription({ type: 'rollback' })
          }
          this.pc.restartIce()
        }
        break
      case 'peer-reconnected':
        // TODO: [Refactor] outra mensagem que só serve pro caller né. Seria bom pensarmos num jeito de diferenciar as mensagens que só são úteis pro caller e quais são uteis pra ambos (eu ACHO que o callee não tem nenhuma mensagem exclusivamente util pra ele né. Além da 'offer'?)
        useCallStore.setState({ status: 'negotiating' })
        if (this.role === 'caller') this.pc?.restartIce()
        break
      case 'ping':
        this.send({ type: 'pong' })
        break
      case 'offer':
        await this.handleOffer(msg.offer)
        break
      case 'answer':
        await this.handleAnswer(msg.answer)
        break
      case 'ice-candidate':
        await this.handleIceCandidate(msg.candidate)
        break
    }
  }

  // ── RTCPeerConnection ───────────────────────────────────────────────────────

  // TODO: Chamado quando o usuário entra na sala. Esse método contém todos os handlers webRTC. Parece com a ideia de handlers do websocket. Ou seja, me parece que essa classe aqui tá fazendo dms. tá rodando dois event loops de conceitos e camadas totalmente diferentes kkkk
  private setupPC(role: 'caller' | 'callee') {
    this.pc?.close()
    this.role = role
    this.remoteDescriptionSet = false
    this.pendingCandidates = []

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.pc = pc
    useCallStore.setState({ pc, role })

    this.media.attachPC(pc)

    // TODO: [Debug] eu tô usando a mesma máquina pra testar tanto o caller quanto o callee, pode ser por isso que a porra do onicecandidate tá demorando tanto pra ser triggado pelo segundo otario que entra? o google (Stun server) tá vendo que já mandou essa porra e não manda mais
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        // TODO: Aqui que a coisa fica meio gambiarra, o websocket chama métodos q mexem com webRTC e metodos que chamam webRTC chamam metodos de websocket hahaha
        this.send({ type: 'ice-candidate', candidate: e.candidate.toJSON() })
      }
    }

    pc.ontrack = (e) => {
      // TODO: [Question] Por que eu pego o streams[0]??? não tem streams[1]???
      useCallStore.setState({ remoteStream: e.streams[0] ?? null })
    }

    pc.oniceconnectionstatechange = () => {
      // TODO: [Refactor] essa lógica tá meio confusa. na vdd tá simples de entender, mas eu gostaria de um jeito mais limpo de representar isso. tá mt escondido algo tão importante como o status da nossa conexão com o outro peer
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        useCallStore.setState({ status: 'connected' })
      } else if (pc.iceConnectionState === 'failed') {
        useCallStore.setState({ status: 'reconnecting' })
        // TODO: [Question] o que caralhos acontece quando restartamos o ice?
        if (role === 'caller') pc.restartIce()
      }
    }

    // TODO: [Refactor] me parece que as mensagens do webRTC tbm têm uma certa lógica né. primeiro o onicecandidate, depois o onnegotiationneeded, depois o oniceconnectionstatechange. Seria legal trackear tbm a progressão desses estados, e pelo menos logar um erro quando foge deles? não sei, só tô pensando se faz sentido modelar isso como uma máquina de estados tbm. Mas me parece que essa porra é basicamente pra callers
    pc.onnegotiationneeded = async () => {
      if (this.role === 'callee') return
      try {
        this.makingOffer = true
        await pc.setLocalDescription()
        this.send({ type: 'offer', offer: pc.localDescription! })
      } finally {
        this.makingOffer = false
      }
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit) {
    // TODO: [Refactor] Dnv essa bosta retornando silenciosamente se PC é null. eu preciso de uma forma de tryGetPC sei lá (esse nome é horrivel) e logar e dar erro caso seja null. sei lá
    const pc = this.pc
    if (!pc) return
    const collision = this.makingOffer || pc.signalingState !== 'stable'
    if (this.role !== 'callee' && collision) return
    // TODO: Pode me explicar que porra é essa de signalingState stable e pq eu boto rollback no localDescription quando nao é stable? o que acontece?
    if (pc.signalingState !== 'stable') {
      await pc.setLocalDescription({ type: 'rollback' })
    }
    await pc.setRemoteDescription(offer)
    this.remoteDescriptionSet = true
    // TODO: O que essa merda faz?
    await this.drainCandidates()
    await pc.setLocalDescription()
    this.send({ type: 'answer', answer: pc.localDescription! })
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    // TODO: [Refactor] Mais um método exclusivo do caller né. não tem nenhuma trava, mas somente o callee manda né. Será que não é bom ter uma trava pra não dar merda se por um acaso cair uma msg dessa pro callee?
    const pc = this.pc
    if (!pc) return
    await pc.setRemoteDescription(answer)
    this.remoteDescriptionSet = true
    await this.drainCandidates()
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (this.remoteDescriptionSet && this.pc) {
      await this.pc.addIceCandidate(candidate)
    } else {
      // TODO: Isso aqui é pra salvar os candidates pra depoi né. mas pela lógica, ele não salva em lugar nenhum e tenta aplicar de uma vez KKKKKKKKKK, essa porra não tá bugada não? parece que sim hein
      this.pendingCandidates.push(candidate)
    }
  }

  private async drainCandidates() {
    if (!this.pc) return
    for (const c of this.pendingCandidates) {
      try {
        await this.pc.addIceCandidate(c)
      } catch {
        // Stale candidate from a previous offer/answer (mismatched ICE ufrag) — safe to skip
      }
    }
    this.pendingCandidates = []
  }

  // ── Public actions ──────────────────────────────────────────────────────────

  hangup() {
    this.teardown('hangup')
    this.navigate(`/room/${this.roomId}/ended`)
  }

  dismissError() {
    const err = useCallStore.getState().error
    useCallStore.setState({ error: null })
    if (
      err?.includes('room is full') ||
      err?.includes("doesn't exist") ||
      err?.includes('another tab') ||
      err?.includes('Unable to connect')
    ) {
      this.navigate('/')
    }
  }
}
