# Daily Sales Calculator

A lightweight web app for logging daily sales, tracking recurring costs, and automatically calculating profit splits between two partners. Built as a hands-on practice project for learning frontend development and cloud backend integration.

## Overview

This app replaces manual pen-and-paper calculations with a simple digital form. Users log daily unit sales, and the app automatically:

- Calculates total daily revenue
- Subtracts fixed daily labor costs
- Tracks recurring weekly and monthly expenses
- Splits net profit evenly between two account holders
- Maintains a running history organized by day, week, and month

## Features

-  **Secure login** — restricted to a fixed set of authorized accounts
-  **Live dashboard** — quick view of today's, this week's, and this month's totals
-  **Daily entry** — simple form-based logging with automatic calculations
-  **Expense tracking** — separate weekly and monthly recurring cost categories
-  **Month-end reports** — full profit/loss breakdown with automatic 50/50 split
-  **Searchable history** — look up any past day by date
-  **Editable records** — correct mistakes without losing data integrity
-  **Mobile-friendly** — installable as a home-screen shortcut on any phone

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (vanilla, no frameworks)
- **Backend:** [Firebase](https://firebase.google.com/) (Authentication + Firestore)
- **Hosting:** Firebase Hosting

## How It Works

1. Authorized users log in with email/password
2. Daily sales figures are entered and saved instantly to a shared cloud database
3. Recurring costs are logged on a weekly and monthly cadence
4. At month's end, the app totals all income and expenses to produce a final profit/loss statement, split evenly between two account holders


## Notes

This project was built as a practical exercise in connecting a static frontend to a real cloud backend — covering authentication, real-time data storage, and basic financial calculations — without relying on any paid services.

## License

This project is for educational/practice purposes.
