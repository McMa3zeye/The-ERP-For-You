# Quick Start Guide - Wood ERP

## ⚠️ Important for Windows Users

On Windows, use **`py`** instead of `python` if `python` command doesn't work.

---

## Step 1: Start Backend (Terminal 1)

### Option A: Use the batch file (Easiest)
```bash
start_backend.bat
```

### Option B: Manual commands
```bash
cd backend
py -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Expected output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

✅ Backend will be at: http://localhost:8000
✅ API docs at: http://localhost:8000/docs

---

## Step 2: Start Frontend (Terminal 2)

### Option A: Use the batch file (Easiest)
```bash
start_frontend.bat
```

### Option B: Manual commands
```bash
cd frontend
npm install
npm run dev
```

**Expected output:**
```
  VITE v5.0.8  ready in XXX ms

  ➜  Local:   http://localhost:5173/
```

✅ Frontend will be at: http://localhost:5173

---

## Common Issues & Fixes

### Issue 1: "Python was not found"
**Solution:** Use `py` instead of `python`
- ✅ Good: `py -m venv venv`
- ❌ Bad: `python -m venv venv`

### Issue 2: "ECONNREFUSED" in frontend
**Solution:** Backend must be running first!
1. Start backend (Step 1)
2. Wait for "Application startup complete"
3. Then start frontend (Step 2)

### Issue 3: "npm is not recognized"
**Solution:** Install Node.js from https://nodejs.org/

### Issue 4: Virtual environment activation fails
**Solution:** Try these commands:
```bash
# PowerShell (if you get execution policy error)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then activate
.\venv\Scripts\Activate.ps1

# OR use Command Prompt (cmd.exe) instead of PowerShell
venv\Scripts\activate.bat
```

---

## Testing the Setup

1. Open browser: http://localhost:5173
2. You should see the dark tree-themed dashboard
3. Try creating a product:
   - Click "Products" in nav
   - Click "Add Product"
   - Fill in form and submit
4. Check backend is working:
   - Open http://localhost:8000/docs
   - You should see API documentation

---

## Color Theme

The ERP uses a **dark tree theme**:
- 🌲 Dark brown backgrounds (#2d1b0e, #3d2817)
- 🌿 Green accents (#a8c090, #7a9565)
- 🪵 Wood grain borders (#5a3921)
- 🍃 Light beige text (#e8e8e8, #d4c4a8)

Perfect for a woodworking business! 🪵

---

## Next Steps

Once everything is running:
1. Create some products
2. Add inventory items
3. Create a sales order
4. Confirm the order (reserves inventory)

Enjoy your open-source ERP! 🚀

