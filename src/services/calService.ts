import { CAL_API_KEY, CAL_EVENT_TYPE_ID } from '../constants';
import type { Booking } from '../types';
import { sendConfirmationEmail } from './emailService';

const BASE_URL = 'https://api.cal.com/v1';

export const fetchBookings = async (): Promise<Booking[]> => {
  try {
    const response = await fetch(`${BASE_URL}/bookings?apiKey=${CAL_API_KEY}&eventTypeId=${CAL_EVENT_TYPE_ID}&status=upcoming`);
    
    if (!response.ok) {
      console.warn(`[CalService] Failed to fetch bookings. Status: ${response.status}`);
      // If unauthorized or not found, return empty array to prevent chat crash
      return [];
    }
    
    const data = await response.json();
    return data.bookings || [];
  } catch (error) {
    console.error('[CalService] Error fetching bookings:', error);
    return [];
  }
};

export const createBooking = async (
  startTime: string,
  name: string,
  email: string,
  notes?: string
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const payload = {
      eventTypeId: CAL_EVENT_TYPE_ID,
      start: startTime, // ISO 8601 string
      responses: {
        name: name,
        email: email,
        notes: notes || 'Booked via DentalCare App',
        location: {
          value: 'inPerson',
          optionValue: ''
        }
      },
      metadata: {},
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: "en"
    };

    const response = await fetch(`${BASE_URL}/bookings?apiKey=${CAL_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create booking');
    }

    // Send confirmation email after successful booking
    await sendConfirmationEmail(email, name, startTime);

    return { success: true, data };
  } catch (error: any) {
    console.error('[CalService] Error creating booking:', error);
    return { success: false, error: error.message || 'Network error occurred while booking' };
  }
};

export const deleteBooking = async (bookingId: number): Promise<boolean> => {
  try {
    const response = await fetch(`${BASE_URL}/bookings/${bookingId}?apiKey=${CAL_API_KEY}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting booking:', error);
    return false;
  }
};