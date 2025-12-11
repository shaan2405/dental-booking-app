import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBooking, fetchBookings } from '../services/calService';
import { createChatSession, handleToolCalls } from '../services/geminiService';
import { logoutUser, getCurrentUser } from '../services/authService';
import type { ChatMessage, Booking } from '../types';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { AI_PHONE_NUMBER } from '../constants';
import { Phone, MessageSquare, Calendar as CalendarIcon, Send, LogOut, Bot, User as UserIcon, CalendarCheck, History, Clock } from 'lucide-react';
import type { Chat, GenerateContentResponse, Part } from "@google/genai";

const PatientDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'manual' | 'history'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hello! I am the DentalCare AI assistant. I can help you check availability and book an appointment.' }
  ]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  
  // Manual Booking State
  const [bookDate, setBookDate] = useState('');
  const [bookEmail, setBookEmail] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<{success: boolean, msg: string} | null>(null);

  // History State
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const navigate = useNavigate();
  const user = getCurrentUser();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize chat session
    const session = createChatSession();
    setChatSession(session);
    
    // Pre-fill email if available
    if (user?.email) {
      setBookEmail(user.email);
    }
    
    // Load history
    loadMyBookings();
  }, []);

  const loadMyBookings = async () => {
    if (!user?.email) return;
    setHistoryLoading(true);
    try {
      const allBookings = await fetchBookings();
      // Filter bookings where one of the attendees matches the current user's email
      const userBookings = allBookings.filter(booking => 
        booking.attendees.some(attendee => attendee.email.toLowerCase() === user.email.toLowerCase())
      );
      setMyBookings(userBookings);
    } catch (e) {
      console.error("Failed to load history", e);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  // Helper to send message with retry logic for 503 errors
  const sendMessageWithRetry = async (session: Chat, payload: string | Part[], maxRetries = 3): Promise<GenerateContentResponse> => {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await session.sendMessage({ message: payload });
      } catch (error: any) {
        attempt++;
        const msg = error.message || JSON.stringify(error);
        const isOverloaded = msg.includes('503') || msg.includes('overloaded') || msg.includes('UNAVAILABLE');
        
        if (isOverloaded && attempt < maxRetries) {
          console.warn(`[Chat] Model overloaded (503). Retrying attempt ${attempt}/${maxRetries} in ${attempt * 1.5}s...`);
          await new Promise(resolve => setTimeout(resolve, 1500 * attempt)); // Exponential backoff
          continue;
        }
        throw error; // If not 503 or max retries reached, throw it
      }
    }
    throw new Error("Service Unavailable after multiple attempts.");
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chatSession) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);

    try {
      // Send initial message with retry
      let result: GenerateContentResponse = await sendMessageWithRetry(chatSession, userMsg);
      
      // Loop to handle potential multiple sequential function calls
      // e.g., model calls checkAvailability -> we respond -> model calls bookAppointment -> we respond
      let maxTurns = 5; // Safety break
      while (result.functionCalls && result.functionCalls.length > 0 && maxTurns > 0) {
        maxTurns--;
        
        // Process the tool calls
        const toolResponses = await handleToolCalls(result.functionCalls);
        
        // If we processed any tools, send the results back
        if (toolResponses.length > 0) {
          const responseParts: Part[] = toolResponses.map(tr => ({
            functionResponse: tr
          }));

          // Send the function responses back to the model with retry
          result = await sendMessageWithRetry(chatSession, responseParts);
          
          // Refresh history if we booked something
          const hasBookingCall = result.functionCalls?.some(fc => fc.name === 'bookAppointment') || 
                                 toolResponses.some(tr => tr.name === 'bookAppointment');
          if (hasBookingCall) {
             loadMyBookings();
          }
        } else {
          // If function calls existed but we produced no responses (e.g. unknown tool), break loop
          break;
        }
      }

      setMessages(prev => [...prev, { role: 'model', text: result.text || "I've processed your request." }]);
    } catch (error: any) {
      console.error("Chat Error:", error);
      
      let errorText = error.message || 'An unexpected error occurred.';
      
      // Try to parse JSON error message if it's stringified
      try {
        if (errorText.includes('{')) {
           const match = errorText.match(/(\{.*\})/);
           if (match) {
             const parsed = JSON.parse(match[1]);
             if (parsed.error?.message) {
               errorText = parsed.error.message;
             }
           }
        }
      } catch (e) { /* ignore parse error */ }
      
      if (errorText.includes('503') || errorText.includes('overloaded')) {
        errorText = "I'm currently experiencing high traffic. Please try again in a moment.";
      } else if (errorText.includes('API key')) {
        errorText = "Configuration Error: Invalid Gemini API Key.";
      } else if (errorText.includes('Fetch')) {
        errorText = "Connection Error: Could not reach the server.";
      }

      setMessages(prev => [...prev, { role: 'model', text: errorText, isError: true }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleManualBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookDate || !bookEmail) return;

    setBookingLoading(true);
    setBookingStatus(null);
    
    // Convert local datetime to ISO
    const isoDate = new Date(bookDate).toISOString();
    
    const result = await createBooking(isoDate, user?.name || 'Patient', bookEmail, 'Manual Web Booking');
    
    setBookingLoading(false);
    if (result.success) {
      setBookingStatus({ success: true, msg: `Appointment booked! A confirmation email has been sent to ${bookEmail}.` });
      setBookDate('');
      loadMyBookings(); // Refresh list
    } else {
      setBookingStatus({ success: false, msg: result.error || 'Failed to book appointment.' });
    }
  };

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <nav className="bg-white shadow-sm z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="bg-teal-600 p-1.5 rounded-lg mr-2">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">DentalCare Patient</span>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-500 mr-4 hidden sm:block">Hello, {user?.name}</span>
              <Button variant="outline" onClick={handleLogout} className="text-sm py-1 px-3">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Call Agent Hero Section */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-2xl shadow-lg p-6 sm:p-10 text-white flex flex-col sm:flex-row items-center justify-between">
          <div className="mb-6 sm:mb-0">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Prefer to talk?</h2>
            <p className="text-teal-100 mb-4 max-w-md">
              Our AI Voice Agent is available 24/7 to answer your questions and manage your bookings instantly.
            </p>
            <div className="flex items-center bg-white/20 backdrop-blur-sm rounded-full px-6 py-3 w-fit">
              <Phone className="h-5 w-5 mr-3 animate-pulse" />
              <span className="text-lg font-bold tracking-wider">{AI_PHONE_NUMBER}</span>
            </div>
          </div>
          <div className="bg-white/10 p-4 rounded-full">
            <Phone className="h-16 w-16 text-white/90" />
          </div>
        </div>

        {/* Interaction Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px] flex flex-col md:flex-row">
          
          {/* Sidebar Tabs */}
          <div className="md:w-64 bg-gray-50 border-r border-gray-200 p-4 flex flex-row md:flex-col gap-2">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 md:flex-none flex items-center p-3 rounded-xl transition-all ${
                activeTab === 'chat' 
                  ? 'bg-white shadow-sm text-teal-700 ring-1 ring-teal-200' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MessageSquare className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">AI Assistant</div>
                <div className="text-xs opacity-75">Chat & Book</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 md:flex-none flex items-center p-3 rounded-xl transition-all ${
                activeTab === 'manual' 
                  ? 'bg-white shadow-sm text-blue-700 ring-1 ring-blue-200' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <CalendarIcon className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Book Online</div>
                <div className="text-xs opacity-75">Manual Form</div>
              </div>
            </button>

            <button
              onClick={() => { setActiveTab('history'); loadMyBookings(); }}
              className={`flex-1 md:flex-none flex items-center p-3 rounded-xl transition-all ${
                activeTab === 'history' 
                  ? 'bg-white shadow-sm text-purple-700 ring-1 ring-purple-200' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <History className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">My Bookings</div>
                <div className="text-xs opacity-75">View History</div>
              </div>
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 relative">
            
            {/* Chat Interface */}
            {activeTab === 'chat' && (
              <div className="flex flex-col h-full h-[500px]">
                <div className="flex-grow overflow-y-auto space-y-4 mb-4 pr-2">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mx-2 ${
                          msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-teal-100 text-teal-600'
                        }`}>
                          {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
                        </div>
                        <div className={`p-3 rounded-2xl text-sm ${
                          msg.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                            : 'bg-gray-100 text-gray-800 rounded-tl-none'
                        } ${msg.isError ? 'border border-red-300 bg-red-50 text-red-800' : ''}`}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="flex items-center space-x-2 bg-gray-50 px-4 py-3 rounded-2xl rounded-tl-none ml-10">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="relative mt-auto">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="e.g., I want to book an appointment next Monday at 10am"
                    className="w-full pl-4 pr-12 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50"
                    disabled={chatLoading}
                  />
                  <button 
                    type="submit" 
                    disabled={chatLoading || !input.trim()}
                    className="absolute right-2 top-2 p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </form>
              </div>
            )}

            {/* Manual Booking Interface */}
            {activeTab === 'manual' && (
              <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto">
                <div className="bg-blue-50 p-4 rounded-full mb-6">
                  <CalendarCheck className="h-10 w-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Book an Appointment</h3>
                <p className="text-gray-500 text-center mb-8">
                  Choose a date and time to visit our clinic.
                </p>

                <form onSubmit={handleManualBooking} className="w-full space-y-4">
                  {bookingStatus && (
                    <div className={`p-4 rounded-lg text-sm text-center ${
                      bookingStatus.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {bookingStatus.msg}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your Email</label>
                    <Input
                      label=""
                      type="email"
                      value={bookEmail}
                      onChange={(e) => setBookEmail(e.target.value)}
                      placeholder="e.g. john@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Date & Time</label>
                    <input
                      type="datetime-local"
                      value={bookDate}
                      onChange={(e) => setBookDate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      required
                    />
                  </div>

                  <Button 
                    type="submit" 
                    variant="secondary" 
                    className="w-full py-3" 
                    isLoading={bookingLoading}
                  >
                    Confirm Booking
                  </Button>
                </form>
              </div>
            )}

            {/* Booking History Interface */}
            {activeTab === 'history' && (
              <div className="h-full flex flex-col">
                 <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">My Appointments</h3>
                  <Button variant="outline" onClick={loadMyBookings} className="text-xs p-1">
                     <History className="w-4 h-4 mr-1" /> Refresh
                  </Button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto">
                    {historyLoading ? (
                      <div className="flex justify-center items-center h-40">
                         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                      </div>
                    ) : myBookings.length === 0 ? (
                      <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100">
                        <CalendarIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">No appointments found for {user?.email}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {myBookings.map((booking) => (
                          <div key={booking.id} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between hover:shadow-md transition-shadow">
                            <div>
                              <div className="flex items-center text-gray-900 font-medium mb-1">
                                <Clock className="w-4 h-4 text-teal-600 mr-2" />
                                {formatDate(booking.startTime)}
                              </div>
                              <div className="text-sm text-gray-500">
                                Doctor Visit
                              </div>
                            </div>
                            <span className="inline-flex mt-2 sm:mt-0 items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 w-fit">
                              Confirmed
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                 </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default PatientDashboard;