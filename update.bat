@echo off
echo ================================================================
echo   Government Loss Dashboard - Update ^& Deploy
echo ================================================================
echo.
echo  Folder: %~dp0
echo  Edit GovtLossData.csv and GovtLossMapped.csv in this folder,
echo  then run this script to rebuild and push to GitHub.
echo.

echo [1/3] Compiling data.json from CSV files...
node "%~dp0process_data.js"
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Data compilation failed!
    echo        Check that GovtLossData.csv and GovtLossMapped.csv
    echo        exist in this folder and try again.
    pause
    exit /b 1
)

echo.
echo [2/3] Staging changes...
cd /d "%~dp0"
git add data.json process_data.js app.js index.html index.css update.bat README.md wizred.png GovtLossMapped.csv .gitignore

echo.
echo [3/3] Committing and pushing to GitHub...
for /f "tokens=*" %%i in ('date /t') do set DATESTAMP=%%i
for /f "tokens=*" %%i in ('time /t') do set TIMESTAMP=%%i
git commit -m "Data refresh: %DATESTAMP% %TIMESTAMP%"
git push origin main

echo.
echo ================================================================
echo   Done! GitHub Pages will update in ~1-2 minutes.
echo   https://georgetaylor3978.github.io/Government-Loss/
echo ================================================================
pause
