import React, { useState } from 'react';

// Mock data to match the "Showing X of 2 accounts" in the mockup
const DEMO_USERS = [
  { id: 1, name: 'fgdhfgdh', role: 'Sales Staff', status: 'Active' },
  { id: 2, name: 'Juan Dela Cruz', role: 'Manager', status: 'Active' },
];

const UserAccounts = () => {
  // Data state
  const [users, setUsers] = useState(DEMO_USERS);
  
  // Filter dropdown states (what is currently selected in the dropdowns)
  const [selectedRole, setSelectedRole] = useState('All Roles');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');

  // Applied filter states (what is actually filtering the list after clicking 'Apply')
  const [activeRole, setActiveRole] = useState('All Roles');
  const [activeStatus, setActiveStatus] = useState('All Statuses');

  // Apply filters button handler
  const handleApplyFilters = () => {
    setActiveRole(selectedRole);
    setActiveStatus(selectedStatus);
  };

  // Clear all filters handler
  const handleClearFilters = () => {
    setSelectedRole('All Roles');
    setSelectedStatus('All Statuses');
    setActiveRole('All Roles');
    setActiveStatus('All Statuses');
  };

  // Remove a single active filter pill
  const removeFilter = (filterType) => {
    if (filterType === 'role') {
      setSelectedRole('All Roles');
      setActiveRole('All Roles');
    }
    if (filterType === 'status') {
      setSelectedStatus('All Statuses');
      setActiveStatus('All Statuses');
    }
  };

  // Derived state: Filter the users based on active filters
  const filteredUsers = users.filter((user) => {
    const matchesRole = activeRole === 'All Roles' || user.role === activeRole;
    const matchesStatus = activeStatus === 'All Statuses' || user.status === activeStatus;
    return matchesRole && matchesStatus;
  });

  const hasActiveFilters = activeRole !== 'All Roles' || activeStatus !== 'All Statuses';

  return (
    <div className="min-h-screen bg-[#F1EDE4] font-sans flex flex-col relative">
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
          <button className="bg-slate-700 text-white text-sm font-medium py-1.5 px-4 rounded transition-colors">
            User Accounts
          </button>
          <button className="text-slate-400 hover:text-white text-sm font-medium py-1.5 px-4 rounded transition-colors">
            Create User Account
          </button>
          <button className="text-slate-400 hover:text-white text-sm font-medium py-1.5 px-4 rounded transition-colors">
            Update Credentials
          </button>
        </div>

        <button className="border border-slate-600 hover:bg-slate-800 text-slate-300 text-sm font-medium py-1.5 px-4 rounded transition-colors">
          Sign Out
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-6 sm:p-12 max-w-5xl mx-auto w-full">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-1">User Accounts</h1>
            <p className="text-slate-500 text-sm">View and manage registered system users.</p>
          </div>
          
          <button className="bg-[#1E293B] hover:bg-[#0F172A] text-white font-semibold py-2.5 px-5 rounded-lg transition-colors flex items-center gap-2 w-fit">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Create User Account
          </button>
        </div>

        {/* Filters Box */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4 animate-fade-in">
          <div className="flex items-center text-[0.65rem] font-bold text-slate-400 tracking-widest uppercase mb-4">
            <span className="mr-3">Filter Users</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-end">
            {/* Role Dropdown */}
            <div className="w-full sm:w-64">
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Role</label>
              <div className="relative">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#1E293B] outline-none transition-colors text-slate-700 text-sm appearance-none bg-white cursor-pointer"
                >
                  <option value="All Roles">All Roles</option>
                  <option value="Admin">Admin</option>
                  <option value="Sales Staff">Sales Staff</option>
                  <option value="Production Staff">Production Staff</option>
                  <option value="Delivery Staff">Delivery Staff</option>
                  <option value="Manager">Manager</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Status Dropdown */}
            <div className="w-full sm:w-64">
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Status</label>
              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#1E293B] outline-none transition-colors text-slate-700 text-sm appearance-none bg-white cursor-pointer"
                >
                  <option value="All Statuses">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Blocked">Blocked</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
              <button 
                onClick={handleApplyFilters}
                className="bg-[#1E293B] hover:bg-[#0F172A] text-white text-sm font-semibold py-2.5 px-6 rounded-lg transition-colors flex-grow sm:flex-grow-0"
              >
                Apply Filters
              </button>
              <button 
                onClick={handleClearFilters}
                className="border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-semibold py-2.5 px-6 rounded-lg transition-colors flex-grow sm:flex-grow-0"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Active Filters Bar */}
        {hasActiveFilters && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 animate-fade-in px-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-slate-500 font-medium">Active filters:</span>
              
              {activeRole !== 'All Roles' && (
                <div className="bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 shadow-sm">
                  Role: {activeRole}
                  <button onClick={() => removeFilter('role')} className="hover:text-blue-900 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {activeStatus !== 'All Statuses' && (
                <div className="bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 shadow-sm">
                  Status: {activeStatus}
                  <button onClick={() => removeFilter('status')} className="hover:text-blue-900 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Showing {filteredUsers.length} of {users.length} accounts
            </div>
          </div>
        )}

        {/* Data Display: Table OR Empty State */}
        {filteredUsers.length > 0 ? (
          /* POPULATED LIST STATE */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in mt-4">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-[#F8F7F3] border-b border-slate-100 text-[0.65rem] font-bold tracking-widest text-slate-500 uppercase">
              <div className="col-span-5 sm:col-span-4">Name</div>
              <div className="col-span-4 sm:col-span-4">Role</div>
              <div className="col-span-3 sm:col-span-4">Status</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                <div 
                  key={user.id}
                  className="grid grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="col-span-5 sm:col-span-4 font-semibold text-slate-900 text-sm">
                    {user.name}
                  </div>
                  <div className="col-span-4 sm:col-span-4 text-slate-500 text-sm">
                    {user.role}
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.7rem] font-bold tracking-wide border ${
                      user.status === 'Active' 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      {user.status}
                    </span>
                  </div>
                  <div className="col-span-1 sm:col-span-1 flex justify-end">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>

            {/* Table Footer */}
            <div className="flex justify-between items-center px-6 py-4 bg-[#F8F7F3] border-t border-slate-100 text-xs font-medium">
              <span className="text-slate-400">{filteredUsers.length} account registered</span>
              <button 
                onClick={() => setUsers([])} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                Clear accounts
              </button>
            </div>
          </div>
        ) : (
          /* NO MATCHING USERS EMPTY STATE */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 sm:p-24 flex flex-col items-center justify-center text-center animate-fade-in mt-4">
            <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mb-6 text-slate-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-3">No Matching Users</h2>
            <p className="text-slate-500 text-sm mb-8 max-w-xs mx-auto leading-relaxed">
              No user accounts match the selected filters.
            </p>

            <button 
              onClick={handleClearFilters}
              className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-3 px-6 rounded-lg transition-colors shadow-sm"
            >
              Clear Filters
            </button>
          </div>
        )}

      </main>
    </div>
  );
};

export default UserAccounts;