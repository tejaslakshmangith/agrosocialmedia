// Replace the values below with your Firebase project config and OpenWeather API key.
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

// OpenWeatherMap API key
const OPENWEATHER_API_KEY = "326a91d7335c678aefd022b9fc949eed";

// Validation warnings
if (firebaseConfig.apiKey === "YOUR_FIREBASE_API_KEY") {
  console.warn("⚠️ Firebase not configured. Replace placeholders in firebase-config.js");
}

if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === "YOUR_OPENWEATHER_API_KEY") {
  console.warn("⚠️ OpenWeather API key not configured. Weather features will not work.");
}
