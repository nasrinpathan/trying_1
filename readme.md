The Velvet Winter Lounge
A sophisticated, adult-themed Christmas party web app featuring games, social connections, badges, and a guest directory.

Vibe: Classy, sexy holiday lounge — playful and elegant, not cheesy.

🛠 Tech Stack
Frontend: Plain HTML, CSS, JavaScript (no frameworks)
Backend: Firebase (Auth, Firestore, Storage)
Fonts: Playfair Display + Inter (Google Fonts)
📁 File Structure
velvet-winter-lounge/
├── index.html          # Main HTML structure
├── config.js           # Firebase configuration (not in repo)
│
├── CSS Files
│   ├── debug.css       # Debug console styles
│   ├── base.css        # Design system, variables, nav, buttons
│   ├── pages.css       # Auth, landing, lounge, rules pages
│   ├── social.css      # Guests, badges, connections, notifications
│   └── games.css       # Games hub, all 4 games, admin panel
│
└── JS Files
    ├── debug.js        # Debug logging utility (loads first)
    ├── core.js         # Firebase, auth, navigation, profile
    ├── social.js       # Guests, badges, connections, achievements
    ├── games.js        # All 4 games + data loading
    └── admin.js        # Admin panel CRUD operations
🚀 Setup
1. Create Firebase Project
Go to Firebase Console
Create a new project
Enable Authentication (Email/Password + Google + Anonymous)
Enable Firestore Database
Enable Storage
2. Configure Firebase
Create config.js with your Firebase credentials:

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
3. Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Game content (questions, challenges, etc.)
    match /{collection}/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Tighten for production
    }
  }
}
4. Storage Security Rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
5. Deploy
Upload all files to your hosting (Firebase Hosting, Netlify, Vercel, etc.)

📱 Features
Pages
Landing — Countdown timer, event info, enter button
Auth — Email/password, Google sign-in, anonymous guest
Lounge — Welcome screen, profile setup, activity cards
Guests — Directory of visible attendees
Games — 4 party games
Rules — House rules / consent guidelines
Admin — Content management (admin users only)
Games
Game	Description
💭 Tonight's Question	Deep conversation starters
⚖️ Would You Rather	Two options, vote & see results
🙈 Never Have I Ever	Confess and see group stats
🎯 Truth or Dare	Classic game with truths & dares
Social Features
Guest Directory — Browse visible attendees
Badges — Give badges to other guests (5/day limit)
Connections — Request connections with other guests
Notifications — Connection requests & badge received
Achievements — Unlockable achievements for activities
🔧 Development
Which file to edit?
Task	Files to modify
Auth / login issues	core.js
Navigation / routing	core.js
Profile / avatar	core.js, pages.css
Landing page / countdown	core.js, pages.css
Guest directory	social.js, social.css
Badges system	social.js, social.css
Connections system	social.js, social.css
Notifications	social.js, social.css
Any game	games.js, games.css
Admin panel	admin.js, games.css
Design tokens / colors	base.css (:root variables)
Buttons / inputs / cards	base.css
Debug console	debug.js, debug.css
JS Load Order (important!)
<script src="debug.js"></script>   <!-- 1st: logging available to all -->
<script src="config.js"></script>  <!-- 2nd: Firebase config -->
<script src="core.js"></script>    <!-- 3rd: Firebase init, auth, state -->
<script src="social.js"></script>  <!-- 4th: uses core.js globals -->
<script src="games.js"></script>   <!-- 5th: uses core.js globals -->
<script src="admin.js"></script>   <!-- 6th: uses core.js + games.js globals -->
Debug Console
Press the 🔧 button (bottom-right) to show debug console
All debugLog() calls appear there
Errors are automatically captured
Design Tokens
CSS variables in base.css:

:root {
  --velvet: #0a0a0f;      /* Dark background */
  --charcoal: #1a1a24;    /* Card backgrounds */
  --champagne: #d4a574;   /* Primary accent (gold) */
  --burgundy: #722f37;    /* Secondary accent */
  --rose: #c9a0a0;        /* Tertiary accent */
  --cream: #f5f0e8;       /* Text color */
  --success: #4ade80;     /* Success green */
  --error: #f87171;       /* Error red */
}
👤 Admin Access
Sign up with an email
Go to Firestore Console
Navigate to config → settings document
Add your email to adminEmails array
Refresh the app — Admin link appears in nav
Or use the admin panel once you have access to add more admin emails.

📋 Firestore Collections
Collection	Purpose
users	User profiles, connections, achievements
config	App settings (event name, date, admin emails)
questions	Tonight's Question prompts
wouldYouRather	WYR options + vote stats
neverHaveIEver	NHIE statements + confession stats
truths	Truth questions for ToD
challenges	Dare prompts for ToD
answers	User answers to Tonight's Question
gameResponses	User votes/responses to WYR, NHIE
badges	Badges given between users
connectionRequests	Pending/accepted connection requests
🎨 Customization
Change Event Details
Via Admin Panel → Settings:

Event Name
Event Tagline
Event Date/Time (for countdown)
Add Content
Via Admin Panel:

Add/edit/delete questions, WYR, NHIE, truths, dares
Styling
Modify CSS variables in base.css to change the color scheme.

📝 License
Private project — not for redistribution.

Built with ❄️ for The Velvet Winter Lounge