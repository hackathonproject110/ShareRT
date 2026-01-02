export enum AppState {
  IDLE = 'IDLE',
  // Sender States
  SENDER_PREPARING = 'SENDER_PREPARING',
  SENDER_WAITING = 'SENDER_WAITING',
  SENDER_SHARING = 'SENDER_SHARING',
  // Receiver States
  RECEIVER_ENTERING_CODE = 'RECEIVER_ENTERING_CODE',
  RECEIVER_CONNECTING = 'RECEIVER_CONNECTING',
  RECEIVER_VIEWING = 'RECEIVER_VIEWING',
}

export interface QAInteraction {
  question: string;
  answer: string;
  timestamp: number;
}

export interface PeerError {
  type: string;
  message: string;
}