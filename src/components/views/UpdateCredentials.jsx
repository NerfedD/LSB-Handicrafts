import React, { useState } from 'react';

const UpdateCredentials = () => {
  // Demo states: 'default', 'error', 'success'
  const [viewState, setViewState] = useState('default');

  // Form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility toggles
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Cycles through all screens and error states for demonstration
  const handleDemoSave = (e) => {
    e.preventDefault();
    if (viewState === 'default') {
      setViewState('error');
      setNewUsername('dgfffg'); // Auto-fill to match your error mockup
    } else if (viewState === 'error') {
      setViewState('success');
    }
  };

  const handleDemoDone = () => {
    setViewState('default');
    setCurrentPassword('');
    setNewUsername('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-[#F1EDE4] font-sans flex flex-col">
      {/* Top Navbar */}
      <header className="bg-[#0F172A] text-white px-6 py-4 flex justify-between items-center shadow-md z-10">
        <div className="flex items-center gap-4">
          <div className="bg-slate-700/50 px-2 py-1 rounded text-[0.65rem] font-bold tracking-wider">
            LSB
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm tracking-wide">LSB Handicrafts</span>
            <span className="text-slate-500 text-xs">·</span>
            <span className="text-slate-400 text-sm">Internal Management System</span>
          </div>
        </div>
        <button className="border border-slate-600 hover:bg-slate-800 text-slate-300 text-sm font-medium py-1.5 px-4 rounded transition-colors">
          Sign Out
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-start justify-center p-6 sm:p-12">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-[600px] mt-4 relative pb-8">
          
          {viewState !== 'success' ? (
            <div className="p-8 sm:p-10 animate-fade-in">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Update Credentials</h1>
                <p className="text-slate-500 text-sm">Update your username or password to keep your account secure.</p>
              </div>

              <form onSubmit={handleDemoSave} className="space-y-8">
                
                {/* SECTION 1: Current Password */}
                <div>
                  <div className="flex items-center text-[0.65rem] font-bold text-slate-400 tracking-widest uppercase mb-4">
                    <span className="mr-3">Verify Current Password</span>
                    <div className="flex-grow border-t border-slate-100"></div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1.5">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrent ? 'text' : 'password'}
                        placeholder="Enter your current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border focus:ring-2 outline-none transition-colors pr-10 ${
                          viewState === 'error' ? 'border-red-400 focus:ring-red-500 text-slate-900' : 'border-slate-200 focus:ring-[#1E293B] text-slate-900'
                        }`}
                      />
                      <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </div>
                    {viewState === 'error' && <p className="text-xs text-red-500 mt-1.5">Current password is incorrect.</p>}
                  </div>
                </div>

                {/* SECTION 2: Update Username */}
                <div>
                  <div className="flex items-center text-[0.65rem] font-bold text-slate-400 tracking-widest uppercase mb-4">
                    <span className="mr-3">Update Username</span>
                    <div className="flex-grow border-t border-slate-100"></div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1.5">New Username</label>
                    <input
                      type="text"
                      placeholder="Enter your new username"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#1E293B] outline-none transition-colors text-slate-900"
                    />
                    <p className="text-xs text-slate-500 mt-1.5">Username must be unique across the system.</p>
                  </div>
                </div>

                {/* SECTION 3: Update Password */}
                <div>
                  <div className="flex items-center text-[0.65rem] font-bold text-slate-400 tracking-widest uppercase mb-4">
                    <span className="mr-3">Update Password</span>
                    <div className="flex-grow border-t border-slate-100"></div>
                  </div>

                  <div className="mb-5 flex items-start gap-3 bg-blue-50 border border-blue-100 py-3 px-4 rounded-lg">
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
                          placeholder="Enter your new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#1E293B] outline-none transition-colors pr-10 text-slate-900"
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
                          placeholder="Re-enter your new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`w-full px-4 py-3 rounded-lg border focus:ring-2 outline-none transition-colors pr-10 text-slate-900 ${
                            viewState === 'error' ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 focus:ring-[#1E293B]'
                          }`}
                        />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </div>
                      {viewState === 'error' && <p className="text-xs text-red-500 mt-1.5">Passwords do not match.</p>}
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-4 pt-2">
                  <button type="submit" className="flex-grow py-3.5 rounded-lg text-white font-semibold bg-[#1E293B] hover:bg-[#0F172A] transition-colors">
                    Save Changes
                  </button>
                  <button type="button" onClick={handleDemoDone} className="py-3.5 px-8 rounded-lg text-slate-700 font-semibold border border-slate-300 hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* SUCCESS STATE */
            <div className="p-10 sm:p-16 animate-fade-in text-center flex flex-col items-center mt-4">
              <div className="w-16 h-16 rounded-full border border-green-200 bg-green-50 text-green-600 flex items-center justify-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h1 className="text-2xl font-bold text-slate-900 mb-3 leading-tight">
                Credentials Updated Successfully
              </h1>
              <p className="text-slate-600 text-sm mb-10">
                Your account credentials have been updated.
              </p>

              <button 
                onClick={handleDemoDone} 
                className="w-full py-3.5 rounded-lg text-white font-semibold bg-[#1E293B] hover:bg-[#0F172A] transition-colors mb-12"
              >
                Done
              </button>

              {/* Success Screen Footer Line */}
              <div className="w-full pt-6 border-t border-slate-100 text-center relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2">
                  <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                </div>
                <p className="text-[0.65rem] text-slate-400">
                  LSB Handicrafts · Internal Management System
                </p>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default UpdateCredentials;