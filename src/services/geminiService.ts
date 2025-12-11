import { GoogleGenAI, Type } from "@google/genai";
import type { FunctionDeclaration, Tool, Chat, FunctionResponse } from "@google/genai";
import { createBooking, fetchBookings } from './calService';

// Fixed: Use process.env.API_KEY directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const bookAppointmentTool: FunctionDeclaration = {
  name: 'bookAppointment',
  description: 'Book a dental appointment for a patient. PRE-CONDITION: You must have the patients Name, Email, and Desired Date/Time.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      dateTime: {
        type: Type.STRING,
        description: 'The start time for the appointment in ISO 8601 format (e.g., 2024-03-25T10:00:00Z). Convert user relative time (like "tomorrow at 2pm") to this format based on current date.',
      },
      name: {
        type: Type.STRING,
        description: 'The full name of the patient.',
      },
      email: {
        type: Type.STRING,
        description: 'The email address of the patient.',
      },
      notes: {
        type: Type.STRING,
        description: 'Any specific reason for the visit (e.g., cleaning, toothache).',
      }
    },
    required: ['dateTime', 'name', 'email'],
  },
};

const checkAvailabilityTool: FunctionDeclaration = {
  name: 'checkAvailability',
  description: 'Check current existing appointments to see busy slots. Use this before booking to ensure the slot is free.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const tools: Tool[] = [
  {
    functionDeclarations: [bookAppointmentTool, checkAvailabilityTool],
  },
];

export const createChatSession = (): Chat => {
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `You are a smart and helpful receptionist for DentalCare Hospital.
      Current Date/Time: ${new Date().toString()}
      
      Your responsibilities:
      1. Answer questions about the clinic.
      2. Help patients book appointments.
      
      Booking Process:
      1. Ask for Patient Name and Email if not known.
      2. Ask for preferred date and time.
      3. Call 'checkAvailability' to see if the requested time overlaps with existing bookings (busy slots).
      4. If available, call 'bookAppointment'.
      5. If busy, suggest alternative times.
      
      Rules:
      - Always output dates in ISO 8601 when calling tools.
      - Be polite and professional.
      - If a tool fails, explain the error to the user.
      `,
      tools: tools,
    },
  });
};

export const handleToolCalls = async (functionCalls: any[]): Promise<FunctionResponse[]> => {
  const results: FunctionResponse[] = [];
  
  if (!functionCalls || !Array.isArray(functionCalls)) {
    return results;
  }

  for (const call of functionCalls) {
    console.log('[Gemini] Tool Call:', call.name, call.args);
    
    try {
      if (call.name === 'bookAppointment') {
        const { dateTime, name, email, notes } = call.args;
        const result = await createBooking(dateTime, name, email, notes);
        
        results.push({
          id: call.id,
          name: call.name,
          response: {
            result: result.success 
              ? `Success: Appointment booked for ${dateTime}. Confirmation email sent to ${email}.` 
              : `Error: Failed to book. ${result.error || 'Unknown error'}.`,
          }
        });
      } else if (call.name === 'checkAvailability') {
        const bookings = await fetchBookings();
        // Return simplified list of busy times to save tokens and avoid complexity
        const busySlots = bookings.map(b => ({ start: b.startTime, end: b.endTime }));
        
        results.push({
          id: call.id,
          name: call.name,
          response: {
            result: JSON.stringify({ 
              busySlots, 
              message: "These are the currently booked slots. All other times between 9am and 5pm are available." 
            })
          }
        });
      } else {
        // Handle unknown tools gracefully
        console.warn(`[Gemini] Unknown tool called: ${call.name}`);
        results.push({
          id: call.id,
          name: call.name,
          response: { result: "Error: Tool not found." }
        });
      }
    } catch (error: any) {
      console.error(`[Gemini] Tool Error (${call.name}):`, error);
      results.push({
        id: call.id,
        name: call.name,
        response: { result: `Error executing tool: ${error.message}` }
      });
    }
  }
  
  return results;
};