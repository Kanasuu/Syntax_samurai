# Talent Matcher

## Overview
Talent Matcher is a comprehensive platform designed to connect students with career opportunities, providing advanced tools for both administrators and students. It features targeted opportunity alerts, AI-powered interview preparation, and a unified dashboard for managing profiles, skills, and applications.

## Tech Stack
- **Frontend Framework**: React 19, Vite, TanStack Router, TanStack Start
- **Styling**: Tailwind CSS v4, shadcn/ui components (Radix UI)
- **Backend & Database**: Supabase
- **AI Integration**: Groq API (for mock interviews and AI ranking)

## Features

### Student Portal
- **Opportunity Browsing**: Discover jobs, internships, and courses tailored to your skills and profile.
- **AI Interview Prep**: Generate mock interviews and practice quizzes powered by Groq AI.
- **Applications Tracking**: Keep track of applied roles and opportunities.
- **Notifications**: Receive targeted, real-time alerts for roles you are eligible for.

### Admin Dashboard
- **Opportunity Management**: Post and manage courses, jobs, and applications easily.
- **AI Ranking**: Automatically rank students for opportunities based on their profiles and skills.
- **Targeted Alerts**: Send notifications to specific student segments based on strict eligibility criteria.

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- Supabase account and project setup
- Groq API Key (for AI features)

### Installation
1. Clone the repository and navigate to the project directory:
   ```bash
   cd talent-matcher-main
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables. Create a `.env` file in the root directory and add the following (replace with your actual keys):
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_GROQ_API_KEY=your_groq_api_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173` (or the port specified by Vite).

### Available Scripts
- `npm run dev`: Starts the local development server.
- `npm run build`: Builds the application for production.
- `npm run preview`: Locally preview the production build.
- `npm run lint`: Runs ESLint to check for code quality issues.
- `npm run format`: Formats code using Prettier.

## Project Structure
- `/src`: Contains the main source code including components, routes, and shared utilities.
  - `/routes`: TanStack Router file-based routing components.
  - `/components`: Reusable UI components (including shadcn/ui).
- `/supabase`: Contains Supabase edge functions (e.g., `match-recommendations`).

## License
Private
