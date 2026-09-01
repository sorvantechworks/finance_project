# ClearPath Cloud V2

This version replaces browser-only storage with Supabase Authentication + PostgreSQL + Row Level Security.

## What is included
- Real email/password sign-in
- Proper sign out
- Cloud-saved financial data
- Per-user data isolation through Supabase RLS
- Income, living costs, loans, chits, temporary debts and payment history
- Basic monthly planning logic
- Responsive redesigned UI
- Fixed card/grid sizing for desktop and mobile
- Existing V1 financial concepts retained

## Setup

### 1. Create a Supabase project
Create a project at supabase.com.

### 2. Run the database schema
Open Supabase SQL Editor and run `supabase_schema.sql` completely.

### 3. Add your public Supabase credentials
Open `script.js` and replace:
SUPABASE_URL = "PASTE_YOUR_SUPABASE_URL"
SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_KEY"

Use the project's public anon/publishable key only.
NEVER use the service_role/secret key in this website.

### 4. Authentication
In Supabase Authentication settings, enable Email/Password.

For simple testing, you can turn off email confirmation, or leave it on and have the friend confirm the email.

To give your friend an account, create it from the Supabase Authentication dashboard or let her use "Create account". If you create the account yourself, you can give her the temporary password you chose. The website will never expose or display a user's password.

### 5. Deploy to the existing Vercel project
Upload/replace:
- index.html
- styles.css
- script.js
- supabase_schema.sql (for your reference; it does not need to be publicly served)

Commit/push the website files to the GitHub repository connected to your existing Vercel project.

Existing project URL:
https://finance-project-lime-nine.vercel.app/

## Important security note
The anon/publishable Supabase key is intended for browser use when RLS is configured correctly. The service_role/secret key is NOT safe in frontend code.

The user can know the friend's initial account email and temporary password if the user creates the account, but the password should not be recoverable from ClearPath after that. Supabase password-reset/change should be used if it is forgotten.

## Data model
Every row has a user_id and RLS allows a signed-in user to access only their own rows.

## Financial model
Free cash = income - living costs - loan EMIs - chit contributions.
A 10% income buffer is protected.
Temporary debt gets a small suggested share of free cash.
A 3× EMI suggestion is shown only when the remaining free cash can support it; normal EMI is already included, so the extra accelerated portion is 2× EMI.

This is a planning model, not professional financial advice.
