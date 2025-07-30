# Monthly Budget Tracker

This is a comprehensive budget tracking application built with HTML, CSS, and JavaScript, using Firebase for the backend.

## Deployment to Vercel

Follow these steps to deploy the application to Vercel using your GitHub account.

### Step 1: Push to GitHub

1.  Create a new repository on your GitHub account.
2.  Upload the `index.html`, `style.css`, and `app.js` files to this repository.

### Step 2: Get Firebase Credentials

1.  Go to your [Firebase Console](https://console.firebase.google.com/).
2.  Select your project (or create a new one).
3.  Go to **Project Settings** (click the gear icon ⚙️).
4.  Under the "General" tab, find the "Your apps" section.
5.  Click on the "</>" icon to get your web app's Firebase configuration. It will look like this:
    ```javascript
    const firebaseConfig = {
      apiKey: "AIza...",
      authDomain: "your-project.firebaseapp.com",
      projectId: "your-project-id",
      storageBucket: "your-project.appspot.com",
      messagingSenderId: "12345...",
      appId: "1:12345..."
    };
    ```
6.  Keep these values handy.

### Step 3: Deploy on Vercel

1.  Go to [Vercel](https://vercel.com/) and sign up or log in with your GitHub account.
2.  From your Vercel dashboard, click **"Add New..." -> "Project"**.
3.  Import the GitHub repository you created in Step 1.
4.  Vercel will detect it as a static project. You don't need to change any build settings.
5.  Before deploying, expand the **"Environment Variables"** section.
6.  Add the following environment variables, using the values you got from Firebase in Step 2. **Important:** The name must be prefixed with `VITE_`.
    * `VITE_API_KEY` = Your Firebase apiKey
    * `VITE_AUTH_DOMAIN` = Your Firebase authDomain
    * `VITE_PROJECT_ID` = Your Firebase projectId
    * `VITE_STORAGE_BUCKET` = Your Firebase storageBucket
    * `VITE_MESSAGING_SENDER_ID` = Your Firebase messagingSenderId
    * `VITE_APP_ID` = Your Firebase appId
7.  Click **"Deploy"**.

Vercel will now build and deploy your site. Once it's finished, you'll have a live URL for your budget tracker!
