import React, { useState } from 'react';

const LoginScreen = ({ onNavigate }) => {
  // Demo state management: 'default', 'error', 'locked'
  const [loginState, setLoginState] = useState('default');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Cycles through states for frontend demonstration
  const handleDemoSubmit = (e) => {
    e.preventDefault();
    if (loginState === 'default') {
      setLoginState('error');
      setEmail('adopin@addu.edu.ph'); // Auto-fill to match your error mockup
    } else if (loginState === 'error') {
      setLoginState('locked');
    } else {
      setLoginState('default');
      setEmail('');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen flex font-sans">
      {/* Left Panel - Branding */}
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

      {/* Right Panel - Login Form */}
      <div className="w-full md:w-1/2 bg-[#F1EDE4] flex items-center justify-center p-6 sm:p-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-12 w-full max-w-md">
          
          <h2 className="text-[0.7rem] font-bold tracking-[0.2em] text-slate-800 uppercase mb-8">
            LSB Handicrafts
          </h2>

          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Hello!</h1>
            <p className="text-slate-500 text-sm">Please sign in to access your account.</p>
          </div>

          {/* Alert Box (Error & Locked States) */}
          {loginState !== 'default' && (
            <div className="mb-6 flex items-start gap-3 bg-[#FEF2F2] border-l-4 border-red-500 py-3 px-4 rounded-r-md">
              <div className="text-red-500 mt-0.5 flex-shrink-0">
                {loginState === 'error' ? (
                  // Alert Circle Icon
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  // Lock Icon
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-red-800">
                  {loginState === 'error' ? 'Incorrect username or password.' : 'Your account has been temporarily locked.'}
                </h3>
                <p className="text-xs text-red-700 mt-1">
                  {loginState === 'error'
                    ? 'Please check your details and try again.'
                    : 'Multiple failed attempts were detected. Please contact your system administrator to restore access.'}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleDemoSubmit} className="space-y-5">
            {/* Username/Email Input */}
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1.5">
                Username or Email
              </label>
              <input
                type="text"
                placeholder="Enter your username or email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loginState === 'locked'}
                className={`w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-[#1E293B] focus:border-transparent outline-none transition-colors ${
                  loginState !== 'default' ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-white border-slate-200 text-slate-900'
                }`}
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loginState === 'locked'}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#1E293B] focus:border-transparent outline-none transition-colors bg-white pr-10 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loginState === 'locked'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {/* Eye Icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Forgot Password Link - NOW A BUTTON */}
            <div className="flex justify-end pt-1">
              <button 
                type="button"
                onClick={() => {
                  console.log("Forgot Password clicked!");
                  if (onNavigate) {
                    onNavigate('forgot');
                  } else {
                    console.error("The onNavigate prop is missing!");
                  }
                }}
                className="text-sm text-[#1E293B] font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loginState === 'locked'}
              className={`w-full py-3.5 rounded-lg text-white font-semibold transition-colors mt-2 ${
                loginState === 'locked'
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-[#1E293B] hover:bg-[#0F172A]'
              }`}
            >
              {loginState === 'locked' ? 'Account Locked' : 'Log In'}
            </button>
          </form>

          {/* Footer Line */}
          <div className="mt-12 pt-6 border-t border-slate-100 text-center relative">
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

export default LoginScreen;