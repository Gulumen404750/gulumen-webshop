@echo off
title Gulumen Webshop
cd /d "%~dp0"
echo Indul a webshop...
echo Megnyitandó cim: http://localhost:3000
echo A bezarashez nyomj Ctrl+C, majd irj: exit
echo.
npm run dev
pause
