# LSB Handicrafts - Admin System

A comprehensive, interactive React-based administrative dashboard and management system developed for LSB Handicrafts. This project serves as a robust prototype for handling various business operations, including inventory, order processing, staff roles, and customer management.

## Features

*   **Dashboard Overview**: Centralized view of key metrics and recent activities.
*   **Order & Delivery Tracking**: Manage orders (`OrdersList`, `OrderDetail`, `EditOrder`) and track deliveries (`DeliveryList`, `DeliveryDetail`).
*   **Inventory & Product Management**: Full control over product catalogs and stock levels (`InventoryList`, `ProductFormPage`).
*   **User & Staff Management**: Role-based access control, staff directory, and activity logs (`AssignStaffRolePage`, `StaffDirectoryPage`, `StaffActivityLogPage`).
*   **Profiles**: Maintain detailed records for Customers and Suppliers.
*   **Authentication**: Secure login, identity verification, and credential management powered by Supabase.

## Tech Stack

*   **Frontend**: React, Vite, Tailwind CSS.
*   **Backend & Database**: Supabase (PostgreSQL, Authentication).
*   **Deployment**: Vercel.

## Project Structure

*   `/src/components/`: Reusable UI components separated into layouts, shared elements, profiles, and views.
*   `/src/hooks/`: Custom React hooks, including `useSupabaseCollection` and `useIdleTimeout`.
*   `/src/lib/`: Supabase client configurations for authentication and database interactions.
*   `/src/utils/`: Utility functions handling formatting, storage, and mock data like `staffData.js` and `activityData.js`.
*   `/supabase/`: Database schema, seed scripts (`seed_profiles.sql`, `seed_staff.sql`), and SQL functions.

## Getting Started

### Prerequisites
*   Node.js
*   npm or yarn
*   A Supabase project

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd LSB-Handicrafts
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Environment Variables:**
    Copy the `.env.example` file to `.env` and fill in your Supabase credentials:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```
4.  **Database Setup:**
    Execute the SQL scripts found in the `/supabase/` directory (`schema.sql`, `seed_profiles.sql`, `seed_staff.sql`) in your Supabase SQL editor to set up the tables and initial data.
5.  **Run the development server:**
    ```bash
    npm run dev
    ```
