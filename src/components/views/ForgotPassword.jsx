import React, { useState } from 'react';

const ForgotPassword = () => {
  // Demo states: 'forgot', 'verify', 'create', 'success'
  const [step, setStep] = useState('forgot');
  const [hasError, setHasError] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Cycles through all screens and error states for demonstration
  const handleDemoNext = (e) => {
    e.preventDefault();
    if (step === 'forgot') {
      setStep('verify');
      setHasError(false);
    } else if (step === 'verify' && !hasError) {
      setHasError(true);
      setAnswer('asdfdfdf'); // Auto-fill to match your error mockup
    } else if (step === 'verify' && hasError) {
      setStep('create');
      setHasError(false);
      setAnswer('');
    } else if (step === 'create' && !hasError) {
      setHasError(true);
    } else if (step === 'create' && hasError) {
      setStep('success');
      setHasError(false);
    } else if (step === 'success') {
      // Loop back to start or redirect to login
      setStep('forgot');
      setEmail('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleBack = () => {
    if (step === 'verify') {
      setStep('forgot');
      setHasError(false);
    } else if (step === 'create') {
      setStep('verify');
      setHasError(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans">
      {/* Left Panel - Branding (Stays Consistent) */}
      <div className="hidden md:flex w-1/2 bg-[#0F172A] p-12 flex-col justify-between relative overflow-hidden">
        <div>
          <div className="relative border border-slate-700/50 p-8 flex flex-col items-center justify-center w-64 rounded-sm mt-12">
            <span className="absolute top-3 left-3 text-slate-500 text-sm leading-none">+</span>
            <span className="absolute top-3 right-3 text-slate-500 text-sm leading-none">+</span>
            <span className="absolute bottom-3 left-3 text-slate-500 text-sm leading-none">+</span>
            <span className="absolute bottom-3 right-3 text-slate-500 text-sm leading-none">+</span>
            <h1 className="text-4xl font-bold text-white tracking-widest">LSB</h1>
            <p className="text-[0.65rem] tracking-[0.3em] text-slate-400 mt-2 uppercase">Handicrafts</p>
          </div>
        </div>

        <div className="max-w-md">
          <p className="text-slate-400 text-sm leading-relaxed mb-12">
            Your styrofoam specialist in creating unique decor pieces! From event centerpieces and wall art to stage backdrops and custom sculptures. Based in Davao City.
          </p>
          <p className="text-[0.65rem] tracking-widest text-slate-500 uppercase font-semibold">
            The Official LSB Internal System
          </p>
        </div>
      </div>

      {/* Right Panel - Dynamic Form Container */}
      <div className="w-full md:w-1/2 bg-[#F1EDE4] flex items-center justify-center p-6 sm:p-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-12 w-full max-w-md flex flex-col relative">
          
          <h2 className="text-[0.7rem] font-bold tracking-[0.2em] text-slate-800 uppercase mb-8">
            LSB Handicrafts
          </h2>

          <form onSubmit={handleDemoNext} className="flex-grow flex flex-col">
            {/* STEP 1: FORGOT PASSWORD */}
            {step === 'forgot' && (
              <div className="animate-fade-in">
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">Forgot Password?</h1>
                  <p className="text-slate-500 text-sm">Enter your username or email to begin the password recovery process.</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1.5">Username or Email</label>
                    <input
                      type="text"
                      placeholder="Enter your username or email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#1E293B] focus:border-transparent outline-none transition-colors text-slate-900"
                    />
                  </div>

                  <button type="submit" className="w-full py-3.5 rounded-lg text-white font-semibold bg-[#1E293B] hover:bg-[#0F172A] transition-colors">
                    Continue
                  </button>
                  
                  <button type="button" className="flex items-center text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium mt-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Login
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: VERIFY IDENTITY */}
            {step === 'verify' && (
              <div className="animate-fade-in">
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">Verify Your Identity</h1>
                  <p className="text-slate-500 text-sm">Please verify your identity before creating a new password.</p>
                </div>

                {hasError && (
                  <div className="mb-6 flex items-start gap-3 bg-[#FEF2F2] border-l-4 border-red-500 py-3 px-4 rounded-r-md">
                    <div className="text-red-500 flex-shrink-0 mt-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm text-red-700">
                      Unable to verify your identity. Please check your information and try again.
                    </p>
                  </div>
                )}

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1.5">Security Question</label>
                    <div className="w-full px-4 py-3.5 rounded-lg bg-[#F4F1EA] text-slate-700 text-sm">
                      What was the name of your elementary school?
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1.5">Answer</label>
                    <input
                      type="text"
                      placeholder="Enter your answer"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      className={`w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-[#1E293B] outline-none transition-colors ${
                        hasError ? 'border-red-400 bg-white text-slate-900' : 'border-slate-200 bg-white text-slate-900'
                      }`}
                    />
                  </div>

                  <button type="submit" className="w-full py-3.5 rounded-lg text-white font-semibold bg-[#1E293B] hover:bg-[#0F172A] transition-colors mt-2">
                    Verify Identity
                  </button>

                  <button type="button" onClick={handleBack} className="flex items-center text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-3">Need administrator assistance?</p>
                  <button type="button" className="w-full py-3 rounded-lg text-slate-700 font-semibold border border-slate-300 hover:bg-slate-50 transition-colors">
                    Request Admin Assistance
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: CREATE NEW PASSWORD */}
            {step === 'create' && (
              <div className="animate-fade-in">
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">Create a New Password</h1>
                  <p className="text-slate-500 text-sm">Choose a new password for your account.</p>
                </div>

                <div className="mb-6 flex items-start gap-3 bg-blue-50 border border-blue-100 py-3 px-4 rounded-lg">
                  <div className="text-blue-500 flex-shrink-0 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-blue-800">
                    Your new password must meet the system's password requirements.
                  </p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1.5">New Password</label>
                    <div className="relative">
                      <input
                        type={showNew ? 'text' : 'password'}
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#1E293B] outline-none transition-colors pr-10"
                      />
                      <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1.5">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border focus:ring-2 outline-none transition-colors pr-10 ${
                          hasError ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 focus:ring-[#1E293B]'
                        }`}
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </div>
                    {hasError && <p className="text-xs text-red-500 mt-1.5">Passwords do not match.</p>}
                  </div>

                  <button type="submit" className="w-full py-3.5 rounded-lg text-white font-semibold bg-[#1E293B] hover:bg-[#0F172A] transition-colors mt-4">
                    Reset Password
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: SUCCESS */}
            {step === 'success' && (
              <div className="animate-fade-in text-center flex flex-col items-center pt-4">
                <div className="w-16 h-16 rounded-full border border-green-200 bg-green-50 text-green-600 flex items-center justify-center mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                
                <h1 className="text-2xl font-bold text-slate-900 mb-6 max-w-[200px] mx-auto leading-tight">
                  Password Reset Successful
                </h1>

                <div className="bg-[#F4F1EA] rounded-xl p-6 text-left w-full mb-8">
                  <ul className="space-y-4">
                    <li className="flex items-start text-sm text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-sm bg-green-600 mt-1.5 mr-3 flex-shrink-0"></span>
                      Your password has been successfully changed.
                    </li>
                    <li className="flex items-start text-sm text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-sm bg-green-600 mt-1.5 mr-3 flex-shrink-0"></span>
                      Your previous password is no longer valid.
                    </li>
                    <li className="flex items-start text-sm text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-sm bg-green-600 mt-1.5 mr-3 flex-shrink-0"></span>
                      Any other active sessions have been signed out for your security.
                    </li>
                  </ul>
                </div>

                <button type="submit" className="w-full py-3.5 rounded-lg text-white font-semibold bg-[#1E293B] hover:bg-[#0F172A] transition-colors">
                  Return to Login
                </button>
              </div>
            )}
          </form>

          {/* Footer Line */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center relative mt-auto">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2">
              <div className="w-1 h-1 rounded-full bg-slate-300"></div>
            </div>
            <p className="text-[0.65rem] text-slate-400">
              LSB Handicrafts · Internal Management System
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;