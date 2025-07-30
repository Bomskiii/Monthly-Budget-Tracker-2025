export default function handler(request, response) {
  const config = {
    apiKey: process.env.VITE_API_KEY,
    authDomain: process.env.VITE_AUTH_DOMAIN,
    projectId: process.env.VITE_PROJECT_ID,
    storageBucket: process.env.VITE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_APP_ID,
  };

  response.status(200)
    .setHeader('Content-Type', 'application/javascript')
    .send(`window.firebaseConfig = ${JSON.stringify(config)};`);
}
