# Respostas aos comentários TODO/INFO

Gerado em 2026-04-16. Respostas organizadas por arquivo, na ordem em que aparecem no código.

---

## `src/lib/call/CallSession.ts`

### 18. L124 — conexão WS é coração

[`src/lib/call/CallSession.ts:124`](../../src/lib/call/CallSession.ts#L124)

> Cara, junto do handleMessage, esse método é um dos coraçÕes da sala né.

Sim. `connectWS` abre o socket e `handleMessage` é o event loop. Dá pra extrair o trio `{ onopen, onmessage, onclose }` num `SignalingChannel` que emite `onMessage(ReceivedMessage)` e `onClose(code)` — aí `CallSession` só cuida de lifecycle e cola com PC. Isolamento de testes fica trivial (mocka o channel).
>>THINK: Discutir mais sobre isso num plano separado. mas parece genial

### 28. L237 — dois event loops na mesma classe

[`src/lib/call/CallSession.ts:237`](../../src/lib/call/CallSession.ts#L237)

> me parece que essa classe aqui tá fazendo dms. tá rodando dois event loops de conceitos e camadas totalmente diferentes

É. WS é sinalização; RTCPeerConnection é media/transport. Eles conversam (offer/answer/ICE chegam pelo WS), mas o loop interno de cada um é independente. Split razoável:

- `SignalingChannel` — só WS.
- `PeerConnection` — só RTC.
- `CallSession` — costura os dois, expõe a API pro hook.

Teste fica viável: dá pra testar a `PeerConnection` com um `SignalingChannel` fake.
>>THINK: Meu amigo, isso aqui é uma task só

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

### 42. L379 — stopScreenShare no lugar errado

[`src/lib/call/CallSession.ts:379`](../../src/lib/call/CallSession.ts#L379)

> Outro método que poderia estar em outro lugar né. mexe mais com o stream do usuário de media e só toca webRTC pra trocar o que tá mandando

Discordo parcialmente (ver item 4). Ele precisa do `pc.getSenders()` → acopla com PC. Se você fizer um `MediaController`, ele vai ter que pedir a PC emprestada de qualquer jeito. Alternativa: `MediaController` dispara evento `onVideoTrackChanged(track)` e a `CallSession` reage chamando `sender.replaceTrack(track)`. Aí stopScreenShare vira só "trocar video track de volta pra camera", sem saber nada de PC.

---

## Remaining structural work (not yet planned)

- Item 18/28 — Extract `SignalingChannel` (WS) and `PeerConnection` (RTC) from `CallSession` into separate classes
- Item 34 — Model ICE/connection state as an explicit FSM
- Item 35 — Decide on a strategy for `pc === null` (typed exception vs. guard at construction time)
