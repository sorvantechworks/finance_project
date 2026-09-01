# ClearPath — Personal Finance Planner

V1 prototype. It tracks monthly income, survival expenses, loans/EMIs, the 3× EMI accelerated-payment rule, chits, temporary family/friend debts, repayment history, and monthly planning guidance.

**Important:** V1 uses browser localStorage. Do not put sensitive financial information into this prototype yet.

## V2 architecture
- Supabase Auth for email/password login
- Supabase Postgres for financial records
- Row Level Security so each user can only access their own data
- Monthly snapshots and transaction history
- Better recommendation engine
- Vercel for the website, giving this project a different deployment approach from the Sorvan Cloudflare site.

Supabase currently provides built-in authentication and Postgres Row Level Security. Its Free plan has a Nano compute instance and a 500 MB database-size quota, which is more than enough for a tiny single-user experiment.
