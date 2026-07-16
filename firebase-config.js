(function (root) {
  "use strict";

  // Firebase web configuration is public by design. Access is protected by
  // Anonymous Authentication, Firestore Security Rules, and the secret room ID.
  root.PIN_FIREBASE_CONFIG = Object.freeze({
    apiKey: "AIzaSyDWNZsnJ5RIPkPXYo_Va6G8cZe-D7omKoY",
    authDomain: "pin-inventory-shared-order.firebaseapp.com",
    projectId: "pin-inventory-shared-order",
    storageBucket: "pin-inventory-shared-order.firebasestorage.app",
    messagingSenderId: "1038883595844",
    appId: "1:1038883595844:web:a3a372086a9f4bd94e3e11",
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
