# Court Connect

Role & Goal
You are a senior full-stack software architect, UI/UX designer, and product engineer.
Design and generate a production-ready web application for a Pickleball Court Booking and Reservation Management System with GCash payment integration.

The system must be scalable, secure, intuitive, and visually high-fidelity.

🔹 Core Application Purpose

Build a web-based system that allows users to:

View available pickleball courts

Book time slots

Pay online via GCash

Manage reservations

Receive booking confirmations

Admins can:

Manage courts, schedules, and prices

View bookings and payments

Block unavailable dates

Generate reports

🔹 Target Users

Players / Customers

Court Administrators

System Administrator

🔹 Functional Requirements
1️⃣ Authentication & User Management

User registration & login

Role-based access (User, Admin)

Profile management

Secure password handling

2️⃣ Court Management (Admin)

Create, update, and delete courts

Set court availability

Define operating hours

Assign hourly rates

Disable courts for maintenance

3️⃣ Booking & Reservation System

Real-time court availability calendar

Time-slot based booking

Conflict prevention (no double booking)

Booking status:

Pending

Paid

Cancelled

Completed

Automatic expiration for unpaid bookings

4️⃣ Payment Gateway Integration (GCash)

GCash checkout flow

Secure payment verification

Webhook handling for payment status

Store transaction references

Prevent duplicate payments

Refund-ready architecture (future-proof)

5️⃣ Notifications

Booking confirmation

Payment success/failure

Email + optional SMS-ready architecture

On-screen toast notifications

6️⃣ Admin Dashboard

Daily / weekly / monthly booking overview

Revenue summary

Upcoming reservations

User activity logs

Exportable reports (CSV/PDF)

🔹 UI / UX Design Requirements
🎨 Visual Design

High-fidelity

Clean & Modern

3D-inspired UI elements

Glassmorphism or soft shadows

Subtle animations (micro-interactions)

Responsive (mobile-first)

🧠 UX Principles (MANDATORY)

KISS – Keep interfaces simple

YAGNI – Only build essential features

DRY – No redundant logic or UI components

Consistency – Reusable components

Accessibility – Clear contrast, readable typography

🔹 Pages & Screens
User Side

Landing Page

Court Listing Page

Booking Calendar View

Booking Summary

GCash Payment Page

Booking History

Profile Page

Admin Side

Admin Dashboard

Court Management Page

Booking Management Page

Payment Records Page

System Settings

🔹 Technical Requirements
Architecture

Clean Architecture

Modular & scalable

Separation of concerns

Frontend

Component-based UI

Reusable design system

Smooth transitions

State management for bookings

Backend

RESTful or API-first design

Secure booking logic

Payment verification handling

Role-based authorization

Database

Users

Courts

Time slots

Bookings

Payments

Audit logs

🔹 Security & Reliability

Input validation

Secure payment handling

Anti-double booking logic

Error handling & fallback states

Logging & monitoring ready

🔹 Deliverables

Generate:

System architecture overview

Database schema

API endpoints

UI component structure

Core booking logic

GCash payment integration flow

High-fidelity UI design descriptions

Clean, maintainable code following SOLID principles

🔹 Constraints

No unnecessary features

No bloated UI

Performance-first

Mobile-friendly by default

🔹 Output Format

Use clear sections

Use code blocks where needed

Explain logic briefly

Prioritize readability and maintainability

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4b09d6bb-7c43-477f-9541-10e5da68fe1f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
