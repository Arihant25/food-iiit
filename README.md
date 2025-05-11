# 🍽️ Food@IIIT

<div align="center">
  <img src="public/android-chrome-512x512.png" alt="Food@IIIT Logo" width="120"/>
  <h3>The Ultimate Food Management Platform for IIIT Hyderabad</h3>
</div>

[![Next.js](https://img.shields.io/badge/Next.js-15.3.1-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green?style=flat-square&logo=supabase)](https://supabase.io/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.0-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)

## 🚀 Overview

Food@IIIT is a comprehensive platform designed to revolutionize the food experience at IIIT Hyderabad. This all-in-one solution helps students and staff manage their mess registrations, view mess menus, trade meal coupons, and much more - all in a sleek, modern interface.

## ✨ Key Features

- **🔐 CAS Authentication** - Secure login using IIIT's Central Authentication Service
- **📝 Mess Registration** - Register for meals with a simple, intuitive interface
- **📊 Mess Analytics** - Track your meal consumption and spending patterns
- **🏆 Leaderboard** - See who's the most active in the food community
- **📋 Mess Menu** - View the day's menu for all campus messes
- **🔄 Meal Listings** - Buy and sell meal coupons with other students
- **📱 Mobile-Friendly Design** - Access on any device with a responsive UI
- **🌓 Dark Mode Support** - Easy on the eyes during late-night food hunts

## 🛠️ Tech Stack

- **Frontend:** Next.js 15, React 18, TailwindCSS 4, Radix UI
- **Backend:** Next.js API Routes, Supabase
- **Authentication:** NextAuth.js with CAS Integration
- **Data Visualization:** Recharts
- **Deployment:** Vercel with Cron Jobs

## 🏁 Getting Started

1. **Clone the repository:**

```bash
git clone https://github.com/your-username/food-iiit.git
cd food-iiit
```

2. **Install dependencies:**

```bash
npm install
# or
yarn install
# or
pnpm install
```

3. **Set up environment variables:**

Create a `.env.local` file with the following variables:
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secure_random_string
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Run the development server:**

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

5. **Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.**

## 🧹 Automated Cleanup

The application includes an automated cleanup system that removes expired meal listings:

- Listings are automatically deleted after the meal time has passed
- Runs daily through a cron job configured in `vercel.json`
- Meal end times: Breakfast (10 AM), Lunch (3 PM), Snacks (7 PM), Dinner (10 PM)
- This helps keep the listings page clean and only shows relevant available meals

Run it manually with `npm run cleanup`.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

<div align="center">
  <p>Made with ❤️ for IIIT Hyderabad</p>
</div>
