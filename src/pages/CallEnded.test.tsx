import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CallEnded from './CallEnded'

function renderCallEnded(roomId = 'coral-tiger-42') {
  return render(
    <MemoryRouter initialEntries={[`/room/${roomId}/ended`]}>
      <Routes>
        <Route path="/room/:id/ended" element={<CallEnded />} />
        <Route path="/" element={<div data-testid="home" />} />
        <Route path="/room/:id" element={<div data-testid="room" />} />
      </Routes>
    </MemoryRouter>,
  )
}

it('renders "Call ended" heading', () => {
  renderCallEnded()
  expect(screen.getByRole('heading', { name: /call ended/i })).toBeInTheDocument()
})

it('renders Rejoin and Return Home buttons', () => {
  renderCallEnded()
  expect(screen.getByRole('button', { name: /rejoin/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /return home/i })).toBeInTheDocument()
})

it('Rejoin navigates back to the same room', async () => {
  renderCallEnded('coral-tiger-42')
  await userEvent.click(screen.getByRole('button', { name: /rejoin/i }))
  expect(screen.getByTestId('room')).toBeInTheDocument()
})

it('Return Home navigates to /', async () => {
  renderCallEnded()
  await userEvent.click(screen.getByRole('button', { name: /return home/i }))
  expect(screen.getByTestId('home')).toBeInTheDocument()
})
