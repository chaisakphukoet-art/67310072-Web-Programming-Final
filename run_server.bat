@echo off
title TechNova IT Store - Web Programming Exam
echo Starting TechNova IT Store Web Server...
cd /d "%~dp0"
"C:\Users\ASUS\Downloads\67310072-SOA_Final\venv\Scripts\python.exe" manage.py runserver 127.0.0.1:8000
pause
