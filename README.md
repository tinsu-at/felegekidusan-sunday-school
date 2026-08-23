# Sunday School Registrar

Build a new Telegram bot for Sunday School student registration.

IMPORTANT:

This is a completely standalone project.

Do not connect it to any other application or AI assistant.

The user-facing registration experience must be entirely in natural Ethiopian Amharic (አማርኛ).

Optimize the experience for Android/Telegram users.

Keep this Phase 1 implementation simple and reliable.

Do NOT build an admin dashboard, export system, AI features, or advanced analytics yet.

1. TELEGRAM BOT

Connect this application to my existing Telegram Bot using the Telegram Bot API.

Use a secure server-side secret:

TELEGRAM_BOT_TOKEN

IMPORTANT:

Never expose the token in frontend code.

Never put the token in the database.

Never display it in the UI.

Never expose it through an API response.

Never include it in logs.

Use a secure server-side Edge Function for Telegram communication and webhook processing.

If the secret needs to be added manually, tell me exactly where to add it using Lovable's secure Secrets feature.

2. START COMMAND

When a user sends /start, show:

🙏 እንኳን ወደ እሁድ ት/ቤት ምዝገባ በደህና መጡ!

የተማሪውን መረጃ በመሙላት ለምዝገባ ይጀምሩ።

Button:

📝 ምዝገባ ጀምር

3. REGISTRATION QUESTIONS

When the user starts registration, ask the following questions ONE AT A TIME.

Do NOT show all questions at once.

Question 1

1️⃣ ሙሉ ስም ከነአያት

እባክዎ የተማሪውን ሙሉ ስም ከነአያት ያስገቡ።

Question 2

2️⃣ የክርስትና ስም

እባክዎ የተማሪውን የክርስትና ስም ያስገቡ።

Question 3

3️⃣ የትውልድ ዘመን

እባክዎ የትውልድ ዘመኑን በኢትዮጵያ አቆጣጠር ያስገቡ።

ለምሳሌ፦ 2012

Question 4

4️⃣ የእናት ስም

እባክዎ የእናቱን ሙሉ ስም ያስገቡ።

Question 5

5️⃣ የእናት ስልክ

እባክዎ የእናቱን ስልክ ቁጥር ያስገቡ።

Accept Ethiopian phone-number formats such as: 09XXXXXXXX +2519XXXXXXXX

Question 6

6️⃣ የአባት ስም

እባክዎ የአባቱን ሙሉ ስም ያስገቡ።

Question 7

7️⃣ የአባት ስልክ

እባክዎ የአባቱን ስልክ ቁጥር ያስገቡ።

Accept Ethiopian phone-number formats such as: 09XXXXXXXX +2519XXXXXXXX

4. VALIDATION

Do not allow required fields to be empty.

For the birth year:

Accept an Ethiopian calendar year.

Reject obviously invalid years.

If invalid, politely ask the user to enter it again in Amharic.

For phone numbers:

Validate Ethiopian phone-number formats.

If invalid, explain the problem in Amharic and ask again.

5. TEMPORARY REGISTRATION STATE

While the user is answering questions, temporarily store their answers so that the bot knows which question they are currently answering.

Do not mix answers between different Telegram users.

Use the Telegram chat/user ID to keep each registration session separate.

6. FINAL CONFIRMATION

After the seventh answer, show:

📋 ያስገቡት መረጃ

👤 ሙሉ ስም፦ [answer]

✝️ የክርስትና ስም፦ [answer]

🎂 የትውልድ ዘመን፦ [answer]

👩 የእናት ስም፦ [answer]

📞 የእናት ስልክ፦ [answer]

👨 የአባት ስም፦ [answer]

📞 የአባት ስልክ፦ [answer]

መረጃው ትክክል ነው?

Buttons:

✅ አዎ፣ አረጋግጣለሁ

❌ ሰርዝ

If the user selects "ሰርዝ", delete the unfinished registration session and return to the start.

7. DATABASE

Create a secure database table called registrations.

Store:

registration_id

telegram_user_id

telegram_chat_id

telegram_username

full_name

christian_name

birth_year_ec

mother_name

mother_phone

father_name

father_phone

created_at

updated_at

Generate a unique registration ID such as:

SS-000001

8. SUCCESS MESSAGE

After the user confirms:

"✅ ምዝገባዎ በተሳካ ሁኔታ ተጠናቋል!

የምዝገባ ቁጥር፦ [registration ID]

🙏 ስለተመዘገቡ እናመሰግናለን!"

9. BASIC SECURITY

Because this registration contains information about children and their parents:

Protect all registration information.

Do not allow one Telegram user to access another user's registration.

Use appropriate database access controls/RLS.

Do not expose parent phone numbers publicly.

Do not expose the Telegram bot token.

Do not unnecessarily log personal information.

10. TELEGRAM WEBHOOK

Create the server-side Telegram webhook required to receive messages.

Make sure:

Telegram can reach the webhook through HTTPS.

Incoming updates are processed correctly.

Duplicate Telegram updates do not create duplicate registrations.

Errors are handled safely.

11. TESTING

Before saying Phase 1 is complete, test the actual Telegram flow:

/start works.

"📝 ምዝገባ ጀምር" works.

Question 1 works.

Question 2 works.

Question 3 works.

Question 4 works.

Question 5 works.

Question 6 works.

Question 7 works.

Invalid phone numbers are rejected.

Invalid birth years are rejected.

Final confirmation displays all answers correctly.

Confirmation saves the registration.

A unique registration ID is generated.

The success message is sent.

Canceling does not save the registration.

Multiple users can register independently without their answers being mixed.

Do not claim the bot is working until the Telegram message flow has actually been tested.

IMPORTANT — PHASE 1 ONLY

Do NOT build:

Admin dashboard

Excel/CSV export

Analytics

Notifications

AI

Payment system

Login system beyond what is necessary for secure backend operation

Additional registration questions

We will add those in later phases after the basic registration bot is confirmed to work.

Start by inspecting the project and implementing this Phase 1 Telegram registration system.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://felegekidusan-sunday-school.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/664e9146-de75-4bb2-b8a3-73e425405907).

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
