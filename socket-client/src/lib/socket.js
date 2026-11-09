import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io('https://localhost:5000');
  }
  return socket;
};