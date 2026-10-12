@echo off
title E-Raport Mid Semester - Server Lokal
cd /d "%~dp0"
echo ============================================================
echo   E-RAPORT MID SEMESTER SMP KRISTEN 65 BASAAN - SERVER LOKAL
echo   Alamat: http://localhost:8081
echo   Jangan tutup jendela ini selama aplikasi dipakai.
echo ============================================================
start "" http://localhost:8081/index.html
python -m http.server 8081
if errorlevel 1 (
  echo.
  echo Python tidak ditemukan. Install Python dari https://www.python.org
  echo atau buka index.html langsung di Chrome/Edge.
  pause
)
