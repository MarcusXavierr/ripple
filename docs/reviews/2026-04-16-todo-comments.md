# Respostas aos comentários TODO/INFO

Gerado em 2026-04-16. Respostas organizadas por arquivo, na ordem em que aparecem no código.

---
## `src/hooks/useWebRTC.ts`

### 2. L7 — Hook alimentado por CallSession + store

[`src/hooks/useWebRTC.ts:7`](../../src/hooks/useWebRTC.ts#L7)

> essa bosta de hook é alimentado por duas coisas basicamente: 1. o CallSession... 2. O callStore

Leitura correta. `CallSession` é a camada de serviço (IO: WebSocket + RTCPeerConnection + MediaDevices). `callStore` (zustand) é estado reativo consumido pelo React. O hook é só cola: monta/desmonta a session e reexpõe o store. Essa divisão é saudável — o incômodo é que a `CallSession` também escreve direto no store (`useCallStore.setState`), então acopla os dois.

**Opção A — EventEmitter caseiro:**

```ts
type CallEvent =
  | { type: 'status'; value: CallStatus }
  | { type: 'localStream'; stream: MediaStream }
  | { type: 'remoteStream'; stream: MediaStream | null }
  | { type: 'error'; message: string }
  | { type: 'role'; role: 'caller' | 'callee' }

class CallSession {
  private listeners = new Set<(e: CallEvent) => void>()
  on(fn: (e: CallEvent) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  private emit(e: CallEvent) { this.listeners.forEach(l => l(e)) }
}
```

O hook `useWebRTC` registra um listener no mount que traduz evento → `useCallStore.setState`. A CallSession **para de importar o store** — fica pura de React/zustand. Ganha testabilidade, controle de escritas e portabilidade. Custa boilerplate.

**Opção B — writer injetado (mais barata, ~80% do benefício):**

```ts
interface CallStateWriter {
  setStatus(s: CallStatus): void
  setLocalStream(s: MediaStream): void
  setRemoteStream(s: MediaStream | null): void
  setError(e: string): void
  setRole(r: 'caller' | 'callee'): void
  reset(): void
}
class CallSession {
  constructor(roomId, navigate, private writer: CallStateWriter) { ... }
}
```

O hook cria o writer amarrando em `useCallStore.setState` e injeta. CallSession só conhece a interface. Sem EventEmitter, sem tradução de evento, mesmo isolamento.

**Decisão:** seguir com a **Opção B (writer)**. Event bus vira útil quando tem múltiplos consumidores; pro tamanho atual do app é exagero.

### 5. L43 — hangup vs release

[`src/hooks/useWebRTC.ts:43`](../../src/hooks/useWebRTC.ts#L43)

> esse é um dos poucos métodos que tocam websocket e webrtc... ele e o release não tentam fazer a mesma coisa?

Não fazem a mesma coisa, mas a semântica ficou confusa:

- `release()` → "um mount desmontou" (refcount--). Só tearsdown se chegou a 0. Pensado pro StrictMode / múltiplas instâncias do hook.
- `hangup()` → "o usuário clicou em desligar". Fecha tudo imediatamente, ignora refcount, navega pro `/ended`.

O bug latente: `hangup` faz `sessions.delete(this.roomId)` mas não zera `entry.count`. Se outro mount tentar dar `release()` depois, vai dar `entry` undefined (o `if (!entry) return` salva, ok). Funciona, mas é frágil. Renomear `release` → `detach` e `hangup` chamar `detach()` internamente deixaria mais claro.

### 6. L45 — dismissError no lugar errado

[`src/hooks/useWebRTC.ts:45`](../../src/hooks/useWebRTC.ts#L45)

> esse é um helper idiota q poderia estar em qualquer lugar, até aqui. não cabe na callsession

Concordo 70%. Ele chama `this.navigate(...)` em alguns casos, então precisa de algo que saiba navegar. Se for pro hook, o hook já tem `useNavigate`. Move pra lá, mata o método da `CallSession`.
>>TODO: Pode mover então fi

---

## `src/types/signaling.ts`

### 7. L6 — nome `enter`

[`src/types/signaling.ts:6`](../../src/types/signaling.ts#L6)

> esse enter é o de quando o oponente entra na sala né. não deveria ter um nome melhor?

Sim. `peer-joined` é o nome padrão da indústria (parelho com o `peer-reconnected` que já existe logo abaixo). Renomear nas duas pontas (backend + frontend) porque o comentário de topo diz "SYNC: keep identical to backend types.ts".

### 8. L8 — `onclose` é nosso ou do peer

[`src/types/signaling.ts:8`](../../src/types/signaling.ts#L8)

> Esse onclose é mandado quando o oponente sai da sala ou quando nós saímos da sala?

Só do servidor pra nós, carregando uma mensagem. Na prática hoje **não é tratado** no `handleMessage` (sem case `onclose`), então o payload morre. Ou apaga o tipo ou implementa. Dado que `PEER_DISCONNECTED` já é sinalizado via close code, isso parece morto.
// Esse eu tenho que pensar mais sobre o que fazer. pq pra eu tomar PEER_DISCONNECTED o outro otário tem q ficar fora 1min sem responder o ping basicamente né (claro que tem risco dele cair logo em seguida e não responder o ping, então temos mts incógnitas. Mas fica a reflexão, se o servidor de ws cair, os dois continuam conseguindo conversar né, já que não vai ter ping pong pra limpar as salas que já existem e jogar peer_disconnected pro front fechar tudo né)

### 10. L23 — mensagens junto das constantes

[`src/types/signaling.ts:23`](../../src/types/signaling.ts#L23)

> cara eu acho que as mensagens tbm poderiam ficar juntos dessas contantes

Faz sentido ter um `MESSAGE_TYPES = { OFFER: 'offer', ANSWER: 'answer', ... } as const` espelhando o `CLOSE_CODES`. Benefício: autocomplete + única fonte de verdade pra backend/frontend. Custo: mais uma camada. Vale se o switch crescer; hoje com 8 tipos eu esperaria.
>>TODO: Pode juntar

### 11. L33 — `ReceivedMessage` duplicada

[`src/types/signaling.ts:33`](../../src/types/signaling.ts#L33)

> usai, essa porra tá duplicada?

Parcialmente. `ServerMessage` = o que o servidor emite como lógica própria. `ReceivedMessage` = `ServerMessage` + os 3 tipos que o servidor apenas relaya do outro peer (`offer`/`answer`/`ice-candidate`). Esses 3 também estão em `ClientMessage` porque o peer envia. Não é duplicação boba — é a mesma mensagem existindo em três direções (emito, relayado-pra-mim, relayado-do-meu-peer). Dá pra deixar mais DRY extraindo um `PeerRelayMessage` e usando nas duas uniões.

---

## `src/store/call.ts`

### 12. L3 — todos os estados necessários?

[`src/store/call.ts:3`](../../src/store/call.ts#L3)

> Esses são todos os estados da call que de fato precisamos

Fluxo natural: `idle → connecting (WS) → waiting (peer entra) → negotiating (SDP/ICE) → connected → (reconnecting | disconnected)`. Está OK. Cover holes:

- `disconnected` não é setado em lugar nenhum hoje — `hangup` só navega. Se não vai usar, tira.
- Falta `ended` explícito pra casos de peer desligar (hoje só redireciona pra `/ended`, não vira estado).
>>TODO: Adicionar ended

---

## `src/lib/call/CallSession.ts`

### 18. L124 — conexão WS é coração

[`src/lib/call/CallSession.ts:124`](../../src/lib/call/CallSession.ts#L124)

> Cara, junto do handleMessage, esse método é um dos coraçÕes da sala né.

Sim. `connectWS` abre o socket e `handleMessage` é o event loop. Dá pra extrair o trio `{ onopen, onmessage, onclose }` num `SignalingChannel` que emite `onMessage(ReceivedMessage)` e `onClose(code)` — aí `CallSession` só cuida de lifecycle e cola com PC. Isolamento de testes fica trivial (mocka o channel).
>>TODO: Discutir mais sobre isso num plano separado. mas parece genial

### 19. L134 — todos os hooks WS

[`src/lib/call/CallSession.ts:134`](../../src/lib/call/CallSession.ts#L134)

> Esses são todos os hooks de websocket que setamos?

Sim: `onopen`, `onmessage`, `onclose`. Falta `onerror` — evento do **browser WebSocket API** (não do backend) que dispara em falhas de transporte: DNS, TLS, handshake falho, desconexão abrupta sem close frame limpo.

**Decisão: adiar.** Deixar um TODO explicativo no código:

```ts
// TODO: ws.onerror dispara em falhas de transporte (DNS, TLS, desconexão abrupta
// sem close frame). Hoje caímos no onclose genérico logo depois. Quando tiver
// agregador de logs (Sentry?), adicionar ws.onerror pra capturar o erro com
// stack antes do close apagar a evidência.
```

### 20. L141 — parse falho sem log

[`src/lib/call/CallSession.ts:141`](../../src/lib/call/CallSession.ts#L141)

> nós precisamos de uma lógica pra logar erro certinho quando nós não conseguimos parsear esse json aí

Concordo. `JSON.parse` joga exception que hoje vira `unhandledrejection` silenciosa. Envelopa:
```ts
let msg: ReceivedMessage
try { msg = JSON.parse(e.data) } catch (err) { console.error('[WS] bad payload', e.data, err); return }
```
>>TODO: Aplicar

### 21. L150 — scheduleReconnect em close "definitivo"

[`src/lib/call/CallSession.ts:150`](../../src/lib/call/CallSession.ts#L150)

> Se por exemplo eu tomo um erro de que a sala tá cheia, pq eu vou chamar o scheduleReconnect?

Você mesmo apontou: pros codes conhecidos `handleCloseCode` devolve `true` e `!handled` é false → não reconecta. Para o code `1000` já tem `return` cedo. O bug real está em close codes **desconhecidos**: a gente reconecta sem saber o porquê, o que pode ser desastroso (ex: server matou por bug nosso, a gente insiste). Melhor default: não reconectar em close code 4xxx desconhecido (é uma rejeição lógica do app), só em `1006` / 1xxx de rede.

### 22. L162 — log de reconexão

[`src/lib/call/CallSession.ts:162`](../../src/lib/call/CallSession.ts#L162)

> precisamos logar que estamos reconectando. de preferencia sabendo o motivo

`scheduleReconnect(reason: string)` recebendo o code/razão do `onclose`, e `console.warn('[WS] reconnecting', { attempt, delay, reason })`. Trivial.
>>TODO: Faça

### 23. L174 — nunca chega a 30s

[`src/lib/call/CallSession.ts:174`](../../src/lib/call/CallSession.ts#L174)

> Nunca chega a 30s se o limite é 3x né. E porra, 30s é tempo pra caralho

Correto: 1s → 2s → 4s, bate no limit antes do cap. O `Math.min(..., 30_000)` é morto hoje. Ou aumenta `MAX_WS_ATTEMPTS` (5-6?) ou baixa o cap pra ~8s. 30s é UX ruim mesmo — usuário já achou que travou.
>>TODO: Diminui pra 8s

### 24. L189 — close code desconhecido sem default

[`src/lib/call/CallSession.ts:189`](../../src/lib/call/CallSession.ts#L189)

> precisamos de uma lógica para botar uma mensagem padrão quando é um close code desconhecido

Combina com o item 21. No fallback: `console.error('[WS] unknown close code', code)` e setar `error: 'Connection lost unexpectedly.'`. Se decidir usar Sentry, esse é exatamente o tipo de log que importa.
>>TODO: Faça isso. E combine com o item 21 pra já matar os dois de uma vez

### 26. L206 — rollback+restartIce no `enter`

[`src/lib/call/CallSession.ts:206`](../../src/lib/call/CallSession.ts#L206)

> pq eu preciso restartar o ice aqui? pra que botar em rollback se não é stable?

Cenário: você é caller e já tinha começado uma oferta quando o peer original cai. Aí chega um peer novo (evento `enter`). A PC pode estar em `have-local-offer` (não-stable). Para emitir oferta nova com ICE restart limpo, a spec exige sair pra `stable` — `setLocalDescription({ type: 'rollback' })` reverte a oferta pendente pra estado estável sem sumir com o transport. Depois `restartIce()` marca pra próxima oferta nova regenerar ufrag/pwd → `onnegotiationneeded` dispara → nova offer com credenciais frescas.

Não é gambiarra, é a cerimônia certa do "perfect negotiation pattern" do W3C. O que fede é ela estar inline no switch — extrai pra `renegotiateForNewPeer()`.

### 28. L237 — dois event loops na mesma classe

[`src/lib/call/CallSession.ts:237`](../../src/lib/call/CallSession.ts#L237)

> me parece que essa classe aqui tá fazendo dms. tá rodando dois event loops de conceitos e camadas totalmente diferentes

É. WS é sinalização; RTCPeerConnection é media/transport. Eles conversam (offer/answer/ICE chegam pelo WS), mas o loop interno de cada um é independente. Split razoável:

- `SignalingChannel` — só WS.
- `PeerConnection` — só RTC.
- `CallSession` — costura os dois, expõe a API pro hook.

Teste fica viável: dá pra testar a `PeerConnection` com um `SignalingChannel` fake.
>>THINK: Meu amigo, isso aqui é uma task só

### 29. L257 — STUN "cachea" na mesma máquina

[`src/lib/call/CallSession.ts:257`](../../src/lib/call/CallSession.ts#L257)

> eu tô usando a mesma máquina pra testar tanto o caller quanto o callee, pode ser por isso que a porra do onicecandidate tá demorando tanto?

Parcialmente. O Google STUN **não cacheia por IP** em sentido que te prejudique — cada binding request é independente e retorna os reflexive candidates normalmente. O que acontece na mesma máquina:

- Browsers às vezes dão **host candidates idênticos** (loopback/LAN) → trickle pode estender porque anda coletando srflx também.
- `stun.l.google.com` às vezes rate-limita por IP de origem sob burst — aí sim dá lag.
- Na mesma máquina, mDNS hostnames (`*.local`) podem falhar em resolver no próprio browser, e ele demora pra desistir.

Tenta: abrir uma janela anônima pra segundo peer, ou usar dois navegadores diferentes. Se quiser certeza, olha `chrome://webrtc-internals` e vê os timestamps de ICE gathering.

### 30. L260 — WS chama WebRTC e vice-versa

[`src/lib/call/CallSession.ts:260`](../../src/lib/call/CallSession.ts#L260)

> o websocket chama métodos q mexem com webRTC e metodos que chamam webRTC chamam metodos de websocket

Sim, é a natureza de sinalização WebRTC — o protocolo **exige** essa dança (ICE candidate local → manda por WS pro peer; offer recebida por WS → seta no PC local). O problema não é que elas se chamem, é que estão no mesmo objeto sem barreira. Com a separação do item 28, elas só conversam por interfaces definidas (`channel.send(msg)` / `onSignalingMessage`).

### 31. L266 — streams[0]

[`src/lib/call/CallSession.ts:266`](../../src/lib/call/CallSession.ts#L266)

> Por que eu pego o streams[0]??? não tem streams[1]???

`RTCTrackEvent.streams` é um array porque, em teoria, um mesmo `MediaStreamTrack` pode pertencer a múltiplas `MediaStream` (o transmissor chama `addTrack(track, streamA, streamB)`). Na nossa `CallSession.setupPC` (L253) a gente só passa **uma** stream: `pc.addTrack(track, stream)`. Logo do lado do receiver sempre chega `streams: [singleStream]`. Seguro usar `[0]`. Se o remoto um dia mandar a track sem stream associada, `streams` é `[]` e aí o `?? null` salva.

### 32. L271 — ice state feio

[`src/lib/call/CallSession.ts:271`](../../src/lib/call/CallSession.ts#L271)

> essa lógica tá meio confusa... tá mt escondido algo tão importante como o status da nossa conexão com o outro peer

Concordo. Dois passos:

1. Escutar `pc.connectionState` (agregado) em vez de só `iceConnectionState`. É mais fiel ao "estou conectado ao peer".
2. Mapear estados num lugar só: `function pcStateToStatus(state): CallStatus`. O handler fica `useCallStore.setState({ status: pcStateToStatus(pc.connectionState) })`.

### 33. L276 — o que é restartar o ICE

[`src/lib/call/CallSession.ts:276`](../../src/lib/call/CallSession.ts#L276)

> o que caralhos acontece quando restartamos o ice?

`restartIce()` marca a PC para, na **próxima** negociação (offer/answer), gerar novos ufrag/pwd ICE. Efeito prático:

- Os candidates atuais são jogados fora.
- Dispara `onnegotiationneeded` (se role é caller) → nova offer com `ice-ufrag` diferente.
- O peer recebe, faz mesmo processo, e a conectividade é restabelecida do zero — útil quando o 4-tuple quebrou (mudou de rede, NAT rebind, caiu Wi-Fi).

É o "tenta de novo" pro transport sem fechar e reabrir a PC inteira (preserva tracks, estado de DTLS, etc.).

### 34. L281 — modelar como máquina de estados

[`src/lib/call/CallSession.ts:281`](../../src/lib/call/CallSession.ts#L281)

> Seria legal trackear tbm a progressão desses estados... faz sentido modelar isso como uma máquina de estados

Faz. `xstate` ou uma máquina caseira com `{ state, transition(event) }`. WebRTC tem várias: `signalingState`, `iceConnectionState`, `iceGatheringState`, `connectionState`. Agregá-las numa FSM de app (`idle|negotiating|connected|reconnecting|failed`) com transições explícitas dá:

- Logging centralizado.
- Transições inválidas detectáveis (warn).
- Testes fáceis (é só chamar `transition(event)` e ver o estado).

Comentário correto sobre "basicamente pra callers" — offer/answer é sempre caller-driven; callee reage.

### 35. L295 — return silencioso em PC null

[`src/lib/call/CallSession.ts:295`](../../src/lib/call/CallSession.ts#L295)

> eu preciso de uma forma de tryGetPC sei lá... logar e dar erro caso seja null

Concordo. `private getPC(): RTCPeerConnection { if (!this.pc) throw new Error('PC not ready'); return this.pc }` e quem chama envolve em try/catch com log. Ou tipo-dirigido: um método `requirePC()` que nunca retorna null.
>>THINK: Acho que a gente pode estourar um tipo de exceção nova, e ter um handler q envolve tudo pra dar um catch nessa exceção e logar, não? Não tenho muita certeza ainda. Ou se sequer faz sentido a gente considerar que pc é vazio. ou se a gente criar ele, e na hora que ver q é vazio já manda ERRO PRO USUÁRIO

### 36. L300 — signalingState stable + rollback

[`src/lib/call/CallSession.ts:300`](../../src/lib/call/CallSession.ts#L300)

> Pode me explicar que porra é essa de signalingState stable e pq eu boto rollback no localDescription quando nao é stable?

`signalingState` é a state machine de SDP da PC:

- `stable` → sem negociação em andamento.
- `have-local-offer` → eu ofereci, esperando answer.
- `have-remote-offer` → peer ofereceu, preciso responder.
- `have-local-pranswer`/`have-remote-pranswer` → raro, para ICE early.
- `closed` → fim.

Cenário do `handleOffer`: sou callee ou tive colisão. Se minha PC estava em `have-local-offer` (tinha acabado de mandar oferta minha), **não posso** aceitar uma offer remota direto — `setRemoteDescription(offer)` quebra. O rollback reseta pra `stable` (desfaz minha offer localmente) sem fechar a PC. Aí posso seguir o caminho callee: setRemoteDescription(offer) → setLocalDescription() (answer) → send.

Isso é exatamente o "Perfect Negotiation Pattern" (W3C): o polite peer (callee aqui) sempre cede em colisões fazendo rollback. Por isso o `collision` check no L298 só dispara early return se **não** somos callee.
>>TODO: Podemos pelo menos refatorar esse lixo?

### 37. L306 — drainCandidates

[`src/lib/call/CallSession.ts:306`](../../src/lib/call/CallSession.ts#L306)

> O que essa merda faz?

Aplica candidates ICE que chegaram **antes** da gente setar `remoteDescription`. Ver `handleIceCandidate` (L321): se `remoteDescriptionSet` é false, o candidate vai pra `pendingCandidates`. `addIceCandidate` requer remoteDescription antes, senão throwa. Depois que setamos o remote (via offer ou answer), a gente "drena" a fila. O try/catch silencioso é pra candidate velho (ufrag mismatch após restart ICE) que é seguro ignorar.

### 39. L325 — pendingCandidates supostamente bugado

[`src/lib/call/CallSession.ts:325`](../../src/lib/call/CallSession.ts#L325)

> Isso aqui é pra salvar os candidates pra depoi né. mas pela lógica, ele não salva em lugar nenhum

Salva sim — `this.pendingCandidates.push(candidate)` (L326) empurra no array. `drainCandidates` (L330) itera e aplica. **Não está bugado.** A cadeia é: chega ICE candidate antes da SDP remota → push na fila. Depois de setRemoteDescription → drain → adiciona tudo → limpa fila. Relê o L321-328 com calma.

### 40. L364 — sender / replaceTrack / kind video hardcoded

[`src/lib/call/CallSession.ts:364`](../../src/lib/call/CallSession.ts#L364)

> pq se tiver essa porra eu replaceTrack e se não tiver eu add? que porra é um sender, como tu sabe que o kind da track é video hardcoded assim?

- **Sender** = `RTCRtpSender`. Pra cada track que a PC está **mandando** pro peer, existe um sender. `pc.getSenders()` te dá a lista.
- **Por que video?** Porque screenshare *substitui* o frame da câmera. Usuário esperaria ver sua tela no quadrado "vídeo" dele, não como uma terceira track. Áudio da tela a gente não pega (requer `audio: true` no getDisplayMedia e mixing).
- **replaceTrack vs addTrack**: em teoria, depois de `setupPC` a gente já adicionou video (L253) porque `localStream` tem uma video track. Então `sender` sempre existe e o `addTrack` é defensivo (se rodar antes da camera). `replaceTrack` é mágico: troca a track **sem renegociar SDP** — é instantâneo pro peer. Se usasse `removeTrack`+`addTrack` dispararia negociação nova a cada toggle de screenshare.

"WebRTC é tão media centered" — sim, foi desenhado pra audio/video. Dados você manda por `RTCDataChannel` (outro mundo).
>>TODO: Saquei, pode apagar esse sessão

### 41. L375 — outros erros no screenshare

[`src/lib/call/CallSession.ts:375`](../../src/lib/call/CallSession.ts#L375)

> outros tipos de erro podem acontecer aqui, não? eu gostaria de pelo menos logar eles

Sim: `NotAllowedError` (user cancelou — não é erro), `NotFoundError`, `NotReadableError` (device ocupado), `AbortError`, `SecurityError`. Diferencia:
```ts
catch (err) {
  if (err instanceof DOMException && err.name === 'NotAllowedError') return
  console.error('[Screenshare] failed', err)
  useCallStore.setState({ error: 'Could not start screen share.' })
}
```

>>TODO: Já tá fix nessa porra de uma vez

### 42. L379 — stopScreenShare no lugar errado

[`src/lib/call/CallSession.ts:379`](../../src/lib/call/CallSession.ts#L379)

> Outro método que poderia estar em outro lugar né. mexe mais com o stream do usuário de media e só toca webRTC pra trocar o que tá mandando

Discordo parcialmente (ver item 4). Ele precisa do `pc.getSenders()` → acopla com PC. Se você fizer um `MediaController`, ele vai ter que pedir a PC emprestada de qualquer jeito. Alternativa: `MediaController` dispara evento `onVideoTrackChanged(track)` e a `CallSession` reage chamando `sender.replaceTrack(track)`. Aí stopScreenShare vira só "trocar video track de volta pra camera", sem saber nada de PC.

### 43. L381 — erros silenciosos em stopScreenShare

[`src/lib/call/CallSession.ts:381`](../../src/lib/call/CallSession.ts#L381)

> Eu imagino que algum desses métodos possa quebrar, certo?... só return com pc vazio me parece ruim

Sim. `replaceTrack` pode rejeitar se a track for incompatível. `stop()` não throwa mas é síncrono. Wrap em try/catch, loga, e setar `isScreenSharing: false` no finally pra não deixar UI mentirosa.
>>TODO: COrrijá essa porra tbm

---

## `src/store/call.test.ts`

### 44. L2 — testes meme

[`src/store/call.test.ts:2`](../../src/store/call.test.ts#L2)

> esses testes testam o que exatamente? porra, que testes memes hein?

Você tem razão, são quase tautológicos: "o store inicializa com os valores que eu escrevi em INITIAL_STATE". O único teste não-meme é o `reset restores initial state` (L34) — esse exercita o `reset()` de verdade, mudando estado e voltando.

Os outros 5 estão cobrindo a forma do `INITIAL_STATE` constante. Se alguém mexer em `INITIAL_STATE` por acidente, eles falham — marginalmente útil, mas TypeScript já pegaria mudanças de tipo. Viraria mais valioso testar:

- **Integração com CallSession**: dá `acquire`, mocka `getUserMedia`, verifica que `localStream` aparece no store.
- **Transições de status**: sequências como `idle → connecting → waiting → connected` disparadas por mensagens mockadas.
- **reset em cenários realistas**: após um hangup, garantir que tudo zerou incluindo `pc` e `ws`.

Esses dão ROI real. Os memes atuais podem ficar (ninharia de manutenção) ou sair — indiferente.
>>TODO: então faça os testes valiosos e apague os inuteis

---

## Resumo de ações sugeridas

Agrupadas por prioridade:

**Bugs/riscos reais:**
- Item 21/24 — reconnect em close code desconhecido é arriscado.
- Item 20 — `JSON.parse` sem try/catch.
- Item 41/43 — erros silenciosos em screenshare.

**Limpeza fácil (baixo risco):**
- Itens 7, 22, 23, 38 — renames, asyncs, logs, guards.

**Refactors estruturais (pensar antes):**
- Itens 1, 28 — quebrar `useWebRTC` / `CallSession` em módulos por responsabilidade.
- Item 34 — FSM explícita.
- Item 44 — testes que valem a pena.

**Decisões pendentes:**
- Item 10 — constantes de tipos de mensagem.
