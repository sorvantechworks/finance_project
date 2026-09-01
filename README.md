# ClearPath Final V1

A complete browser-based personal finance planner for the first usable release.

## Included
- Local profile/login UI
- Dashboard
- Month selector
- Monthly income
- Essential living expenses
- Multiple loans with balance, EMI and interest rate
- 3× EMI reference
- Chits
- Temporary family/friend debts
- Repayment recording
- Activity history
- Basic monthly financial planning logic
- Responsive desktop/mobile interface
- Browser persistence

## Basic planning logic
1. Income is entered for the selected month.
2. Living expenses, EMI and chit contributions are treated as mandatory monthly commitments.
3. Free cash = income - living expenses - EMI - chits.
4. A basic 10% income buffer is suggested.
5. If free cash is negative, the app recommends no extra debt payment.
6. If free cash is tight, it recommends preserving the buffer.
7. Temporary debts receive a small suggested installment based on available cash.
8. If the remaining cash after the buffer and temporary-debt allowance can cover 2× the largest EMI, the app flags that a 3× EMI total payment may fit.
9. Otherwise it shows the available extra-payment pool instead of forcing a 3× EMI payment.

This is intentionally a simple planning model, not professional financial advice. We can change the rules later.

## Important storage limitation
This version stores information in browser localStorage. The login is a local profile UI, not real secure authentication. Do not use it as a secure system for sensitive financial records.

## Hosting
The project is static HTML/CSS/JS and can be deployed to Vercel Drop. Put `index.html` at the project root.

For future updates while keeping one permanent URL, connect the project to GitHub and then connect that repository to Vercel.
