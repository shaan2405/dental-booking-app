import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBookings, deleteBooking } from '../services/calService';
import { logoutUser, getCurrentUser } from '../services/authService';
import type { Booking } from '../types';
import { Button } from '../components/Button';
import { LogOut, Calendar, Clock, Trash2, User, Mail, RefreshCw } from 'lucide-react';

const DoctorDashboard: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const user = getCurrentUser();

  const loadBookings = async () => {
    setIsLoading(true);
    const data = await fetchBookings();
    setBookings(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to cancel this appointment?')) {
      const success = await deleteBooking(id);
      if (success) {
        setBookings(prev => prev.filter(b => b.id !== id));
      } else {
        alert('Failed to delete booking');
      }
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">Doctor Portal</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">Welcome, {user?.name}</span>
              <Button variant="outline" onClick={handleLogout} className="flex items-center">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Today's Appointments</h1>
          <Button onClick={loadBookings} variant="secondary" className="flex items-center">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh List
          </Button>
        </div>

        {bookings.length === 0 && !isLoading ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No appointments found</h3>
            <p className="mt-1 text-sm text-gray-500">Your schedule is clear for now.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {bookings.map((booking) => (
              <div key={booking.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Confirmed
                    </span>
                    <button 
                      onClick={() => handleDelete(booking.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title="Cancel Appointment"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center text-gray-900 font-medium">
                      <User className="h-5 w-5 text-gray-400 mr-2" />
                      {booking.attendees[0]?.name || 'Unknown Patient'}
                    </div>
                    
                    <div className="flex items-center text-gray-600 text-sm">
                      <Clock className="h-5 w-5 text-gray-400 mr-2" />
                      {formatDate(booking.startTime)}
                    </div>
                    
                    <div className="flex items-center text-gray-600 text-sm">
                      <Mail className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="truncate">{booking.attendees[0]?.email}</span>
                    </div>

                    {booking.description && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                        "{booking.description}"
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default DoctorDashboard;