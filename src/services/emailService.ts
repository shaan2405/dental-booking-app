export const sendConfirmationEmail = async (to: string, name: string, date: string): Promise<boolean> => {
  console.log(`[Email Service] Preparing to send confirmation to ${to}...`);
  
  // Simulate network delay for email sending (1.5 seconds)
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Log the "email" to the console
  console.log(`
    ----------------------------------------------------
    📧 MOCK EMAIL SENT
    ----------------------------------------------------
    To: ${to}
    Subject: Appointment Confirmation - DentalCare Hospital
    ----------------------------------------------------
    Dear ${name},
    
    Your appointment has been successfully booked.
    
    Date & Time: ${new Date(date).toLocaleString()}
    Location: DentalCare Hospital
    
    Please arrive 10 minutes early.
    
    Regards,
    DentalCare Team
    ----------------------------------------------------
  `);
  
  return true;
};

export const sendPasswordResetEmail = async (to: string, name: string, otp: string): Promise<boolean> => {
  console.log(`[Email Service] Preparing to send password reset OTP to ${to}...`);
  
  // No delay needed for OTP usually, but let's keep it snappy
  
  // Log the "email" to the console
  console.log(`
    ----------------------------------------------------
    📧 MOCK EMAIL SENT (Password Reset)
    ----------------------------------------------------
    To: ${to}
    Subject: Password Reset - DentalCare Hospital
    ----------------------------------------------------
    Dear ${name},
    
    You requested a password reset.
    
    Your Verification Code: ${otp}
    
    This code expires in 15 minutes.
    
    If you did not request this, please ignore this email.
    ----------------------------------------------------
  `);
  
  return true;
};