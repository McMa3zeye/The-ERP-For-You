@echo off
echo Starting Backend Server...
cd backend
if not exist venv (
    echo Creating virtual environment...
    py -m venv venv
)
call venv\Scripts\activate
if not exist venv\Lib\site-packages\fastapi (
    echo Installing dependencies...
    pip install -r requirements.txt --quiet
)
echo.
echo Backend server starting on http://localhost:8000
echo API docs available at http://localhost:8000/docs
echo.
uvicorn main:app --reload

