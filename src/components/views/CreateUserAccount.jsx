import React, { useState } from 'react';

const CreateUserAccount = () => {
  // Demo states: 'default', 'error', 'success'
  const [viewState, setViewState] = useState('default');

  // Form states
  const [employeeName, setEmployeeName] = useState('');
  const [role, setRole] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Cycles through all screens and error states for demonstration
  const handleDemoSubmit = (e) => {
    e.preventDefault();
    if (viewState === 'default') {
      setViewState('error');
    } else if (viewState === 'error') {
      setViewState('success');
    }
  };

  const handleDemoDone = () => {
    setViewState('default');
    setEmployeeName('');
    setRole('');
    setContactNumber('');
    setUsername('');
    setEmail('');
    setTemporaryPassword('');
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
            <span className="font-semibold text-sm tracking-wide hidden sm:inline">LSB Handicrafts</span>
            <span className="text-slate-500 text-xs hidden sm:inline">·</span>
            <span className="text-slate-400 text-sm hidden sm:inline">Internal Management System</span>
          </div>
        </div>

        {/* Center Navigation */}
        <div className="hidden md:flex items-center gap-2">
          <button className="text-slate-400 hover:text-white text-sm font-medium py-1.5 px-4 rounded transition-colors">
            Update Credentials
          </button>
          <button className="bg-slate-800 text-white text-sm font-medium py-1.5 px-4 rounded transition-colors">
            Create User Account
          </button>
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
              <div className="w-6 h-1 bg-[#1E293B] mb-5 rounded-full"></div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Create User Account</h1>
                <p className="text-slate-500 text-sm">Create an account for a new employee.</p>
              </div>

              <form onSubmit={handleDemoSubmit} className="space-y-8">
                
                {/* SECTION 1: Employee Information */}
                <div>
                  <div className="flex items-center text-[0.65rem] font-bold text-slate-400 tracking-widest uppercase mb-4">
                    <span className="mr-3">Employee Information</span>
                    <div className="flex-grow border-t border-slate-100"></div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    {/* Employee Name */}
                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1.5">Employee Name</label>
                      <input
                        type="text"
                        placeholder="Enter employee name"
                        value={employeeName}
                        onChange={(e) => setEmployeeName(e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border focus:ring-2 outline-none transition-colors text-slate-900 ${
                          viewState === 'error' ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 focus:ring-[#1E293B]'
                        }`}
                      />
                      {viewState === 'error' && <p className="text-xs text-red-500 mt-1.5">This field is required.</p>}
                    </div>

                    {/* Role */}
                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1.5">Role</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border focus:ring-2 outline-none transition-colors text-slate-900 appearance-none bg-white ${
                          viewState === 'error' ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 focus:ring-[#1E293B]'
                        } ${!role ? 'text-slate-400' : ''}`}
                      >
                        <option value="" disabled hidden>Select role</option>
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                        <option value="manager">Manager</option>
                      </select>
                      {viewState === 'error' && <p className="text-xs text-red-500 mt-1.5">This field is required.</p>}
                    </div>
                  </div>

                  {/* Contact Number */}
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1.5">Contact Number</label>
                    <input
                      type="text"
                      placeholder="Enter contact number"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      className={`w-full px-4 py-3 rounded-lg border focus:ring-2 outline-none transition-colors text-slate-900 ${
                        viewState === 'error' ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 focus:ring-[#1E293B]'
                      }`}
                    />
                    {viewState === 'error' && <p className="text-xs text-red-500 mt-1.5">This field is required.</p>}
                  </div>
                </div>

                {/* SECTION 2: Login Credentials */}
                <div>
                  <div className="flex items-center text-[0.65rem] font-bold text-slate-400 tracking-widest uppercase mb-4">
                    <span className="mr-3">Login Credentials</span>
                    <div className="flex-grow border-t border-slate-100"></div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    {/* Username */}
                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1.5">Username</label>
                      <input
                        type="text"
                        placeholder="Enter username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border focus:ring-2 outline-none transition-colors text-slate-900 ${
                          viewState === 'error' ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 focus:ring-[#1E293B]'
                        }`}
                      />
                      {viewState === 'error' && <p className="text-xs text-red-500 mt-1.5">This field is required.</p>}
                      <p className="text-xs text-slate-500 mt-1.5">Username must be unique across the system.</p>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1.5">Email</label>
                      <input
                        type="email"
                        placeholder="Enter email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border focus:ring-2 outline-none transition-colors text-slate-900 ${
                          viewState === 'error' ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 focus:ring-[#1E293B]'
                        }`}
                      />
                      {viewState === 'error' && <p className="text-xs text-red-500 mt-1.5">This field is required.</p>}
                    </div>
                  </div>

                  {/* Temporary Password */}
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1.5">Temporary Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter temporary password"
                        value={temporaryPassword}
                        onChange={(e) => setTemporaryPassword(e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border focus:ring-2 outline-none transition-colors pr-10 text-slate-900 ${
                          viewState === 'error' ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 focus:ring-[#1E293B]'
                        }`}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </div>
                    {viewState === 'error' && <p className="text-xs text-red-500 mt-1.5">This field is required.</p>}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-4 pt-2">
                  <button type="submit" className="flex-grow py-3.5 rounded-lg text-white font-semibold bg-[#1E293B] hover:bg-[#0F172A] transition-colors">
                    Create Account
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
                Account Created Successfully
              </h1>
              <p className="text-slate-600 text-sm mb-10">
                The new user account has been created successfully.
              </p>

              <div className="flex gap-4 w-full max-w-sm justify-center mb-12">
                <button 
                  onClick={handleDemoDone} 
                  className="py-3.5 px-8 rounded-lg text-white font-semibold bg-[#1E293B] hover:bg-[#0F172A] transition-colors"
                >
                  Done
                </button>
                <button 
                  type="button" 
                  className="py-3.5 px-8 rounded-lg text-slate-700 font-semibold border border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  View User Accounts
                </button>
              </div>

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

export default CreateUserAccount;