import { io } from 'socket.io-client'

const BASE = typeof window !== 'undefined' ? window.location.origin : ''

export const socket = io(BASE, {
  transports: ['websocket', 'polling'],
  autoConnect: true,
})
