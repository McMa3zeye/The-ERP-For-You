@echo off
echo Starting Frontend Server...
cd frontend
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
echo.
echo Frontend server starting on http://localhost:5173
echo.
call npm run dev

