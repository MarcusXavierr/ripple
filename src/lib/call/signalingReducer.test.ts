import { describe, it, expect } from 'vitest'
import { reduce } from './signalingReducer'
import type { SignalingState, SignalingAction } from './signalingReducer'
import type { ReceivedMessage } from '@/types/signaling'

const base: SignalingState = {
  role: null,
  makingOffer: false,
  signalingState: 'stable',
}

function state(overrides: Partial<SignalingState>): SignalingState {
  return { ...base, ...overrides }
}

const cases: Array<{
  name: string
  state: SignalingState
  msg: ReceivedMessage
  expected: SignalingAction[]
}> = [
  // onopen
  {
    name: 'onopen as caller → setup PC + waiting',
    state: state({}),
    msg: { type: 'onopen', role: 'caller', reconnect: false },
    expected: [{ type: 'SETUP_PC', role: 'caller' }, { type: 'SET_STATUS', status: 'waiting' }],
  },
  {
    name: 'onopen as callee → setup PC + waiting',
    state: state({}),
    msg: { type: 'onopen', role: 'callee', reconnect: false },
    expected: [{ type: 'SETUP_PC', role: 'callee' }, { type: 'SET_STATUS', status: 'waiting' }],
  },

  // ping
  {
    name: 'ping → send pong',
    state: state({}),
    msg: { type: 'ping' },
    expected: [{ type: 'SEND_WS', msg: { type: 'pong' } }],
  },

  // enter
  {
    name: 'enter as caller (stable) → negotiating + restart ICE',
    state: state({ role: 'caller', signalingState: 'stable' }),
    msg: { type: 'enter' },
    expected: [{ type: 'SET_STATUS', status: 'negotiating' }, { type: 'RESTART_ICE' }],
  },
  {
    name: 'enter as caller (non-stable) → negotiating + rollback+restart',
    state: state({ role: 'caller', signalingState: 'have-local-offer' }),
    msg: { type: 'enter' },
    expected: [{ type: 'SET_STATUS', status: 'negotiating' }, { type: 'ROLLBACK_AND_RESTART_ICE' }],
  },
  {
    name: 'enter as callee → warn',
    state: state({ role: 'callee' }),
    msg: { type: 'enter' },
    expected: [{ type: 'WARN', message: expect.any(String) as string }],
  },

  // peer-reconnected
  {
    name: 'peer-reconnected as caller → negotiating + restart ICE',
    state: state({ role: 'caller' }),
    msg: { type: 'peer-reconnected' },
    expected: [{ type: 'SET_STATUS', status: 'negotiating' }, { type: 'RESTART_ICE' }],
  },
  {
    name: 'peer-reconnected as callee → warn',
    state: state({ role: 'callee' }),
    msg: { type: 'peer-reconnected' },
    expected: [{ type: 'WARN', message: expect.any(String) as string }],
  },

  // offer
  {
    name: 'offer as callee → handle offer',
    state: state({ role: 'callee' }),
    msg: { type: 'offer', offer: { type: 'offer', sdp: 'sdp' } },
    expected: [{ type: 'HANDLE_OFFER', offer: { type: 'offer', sdp: 'sdp' } }],
  },
  {
    name: 'offer as caller (no collision) → handle offer',
    state: state({ role: 'caller', makingOffer: false, signalingState: 'stable' }),
    msg: { type: 'offer', offer: { type: 'offer', sdp: 'sdp' } },
    expected: [{ type: 'HANDLE_OFFER', offer: { type: 'offer', sdp: 'sdp' } }],
  },
  {
    name: 'offer as caller (making offer) → warn (collision)',
    state: state({ role: 'caller', makingOffer: true, signalingState: 'stable' }),
    msg: { type: 'offer', offer: { type: 'offer', sdp: 'sdp' } },
    expected: [{ type: 'WARN', message: expect.any(String) as string }],
  },
  {
    name: 'offer as caller (non-stable) → warn (collision)',
    state: state({ role: 'caller', makingOffer: false, signalingState: 'have-local-offer' }),
    msg: { type: 'offer', offer: { type: 'offer', sdp: 'sdp' } },
    expected: [{ type: 'WARN', message: expect.any(String) as string }],
  },

  // answer
  {
    name: 'answer as caller → handle answer',
    state: state({ role: 'caller' }),
    msg: { type: 'answer', answer: { type: 'answer', sdp: 'sdp' } },
    expected: [{ type: 'HANDLE_ANSWER', answer: { type: 'answer', sdp: 'sdp' } }],
  },
  {
    name: 'answer as callee → warn',
    state: state({ role: 'callee' }),
    msg: { type: 'answer', answer: { type: 'answer', sdp: 'sdp' } },
    expected: [{ type: 'WARN', message: expect.any(String) as string }],
  },

  // ice-candidate
  {
    name: 'ice-candidate → handle candidate',
    state: state({}),
    msg: { type: 'ice-candidate', candidate: { candidate: 'c', sdpMid: null, sdpMLineIndex: null } },
    expected: [{ type: 'HANDLE_ICE_CANDIDATE', candidate: { candidate: 'c', sdpMid: null, sdpMLineIndex: null } }],
  },
]

describe('reduce', () => {
  it.each(cases)('$name', ({ state: s, msg, expected }) => {
    expect(reduce(s, msg)).toEqual(expected)
  })
})
