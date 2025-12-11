export type UserRole = 'doctor' | 'patient';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
}

export interface Booking {
  id: number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  attendees: {
    name: string;
    email: string;
    timeZone: string;
  }[];
  status: string;
  uid: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}