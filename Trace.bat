@echo off
title Trace Launcher
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0trace-launcher.ps1"
if errorlevel 1 pause
