# Email Setup for Password Reset

## Step 1: Get Gmail App Password

1. Go to **https://myaccount.google.com** and sign in with `erpforyou.reset@gmail.com`
2. Click **Security** (left sidebar)
3. Under "How you sign in to Google", find **2-Step Verification**
   - If it's OFF: Turn it ON (Google will guide you)
   - If it's ON: Continue to step 4
4. Still on the Security page, scroll down to **App passwords**
5. Click **App passwords**
6. Select app: **Mail**
7. Select device: **Other (Custom name)** → type "Wood ERP"
8. Click **Generate**
9. **Copy the 16-character password** (it looks like: `abcd efgh ijkl mnop`)

## Step 2: Create the .env file

1. Open the `backend` folder in your file explorer
2. Create a new file named `.env` (yes, it starts with a dot)
3. Copy and paste this into the file:

```
GMAIL_USER=erpforyou.reset@gmail.com
GMAIL_APP_PASSWORD=paste-your-16-character-password-here
FRONTEND_URL=http://localhost:5173
```

4. Replace `paste-your-16-character-password-here` with the actual password from Step 1 (remove spaces if any)
5. Save the file

## Step 3: Install python-dotenv

Open PowerShell in the `backend` folder and run:

```powershell
pip install python-dotenv
```

Or if you're using a virtual environment:

```powershell
.\venv\Scripts\activate
pip install python-dotenv
```

## Step 4: Restart the backend

Stop your backend server (Ctrl+C) and start it again with `start_backend.bat`

## Done! ✅

Now when someone uses "Forgot Password", the system will send an email from `erpforyou.reset@gmail.com`.
