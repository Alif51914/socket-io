import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    // এখানে localhost এর জায়গায় env variable বসিয়ে দিচ্ছি
    socket = io(process.env.NEXT_PUBLIC_BACKEND_URL);
  }
  return socket;
};