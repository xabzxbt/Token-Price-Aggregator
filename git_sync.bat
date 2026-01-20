@echo off
setlocal enabledelayedexpansion

:: ==========================================
::   UNIVERSAL GIT SYNC TOOL
:: ==========================================

:MENU
cls
echo ==========================================
echo       GIT SYNC TOOL - BY QODER
echo ==========================================
echo.
echo  1. [SETUP] Initial PUSH (Clean Start)
echo  2. [UPDATE] Fast Sync (Add + Commit + Push)
echo  3. [BRANCH] Rename Master to Main
echo  4. [CONFIG] Set/Change Repository URL
echo  5. [EXIT] Quit
echo.
set /p choice="Choose an option (1-5): "

if "%choice%"=="1" goto SETUP
if "%choice%"=="2" goto UPDATE
if "%choice%"=="3" goto RENAME_BRANCH
if "%choice%"=="4" goto CONFIG
if "%choice%"=="5" exit
goto MENU

:SETUP
cls
echo [SETUP] INITIAL REPOSITORY PUSH
set /p repo_url="Enter GitHub Repository URL: "
set /p branch_name="Enter Branch Name (main/master) [main]: "
if "%branch_name%"=="" set branch_name=main

if exist .git (
    echo.
    echo Warning: .git folder already exists.
    set /p confirm="Delete existing .git and start fresh? (y/n): "
    if /i "!confirm!"=="y" (
        rmdir /s /q .git
    )
)

git init
git branch -M %branch_name%
git add .
git commit -m "Initial upload"
git remote add origin %repo_url%
git push -u origin %branch_name% --force

echo.
echo SETUP COMPLETE!
pause
goto MENU

:UPDATE
cls
echo [UPDATE] FAST SYNCING CHANGES
:: Detect current branch
for /f "tokens=*" %%a in ('git rev-parse --abbrev-ref HEAD') do set current_branch=%%a
if "%current_branch%"=="" (
    echo Error: Not a git repository. Run Setup first.
    pause
    goto MENU
)

echo Current branch: %current_branch%
git add .
set datetime=%date% %time%
git commit -m "Update: %datetime%"
git push origin %current_branch%

echo.
echo UPDATE COMPLETE!
pause
goto MENU

:RENAME_BRANCH
cls
echo [BRANCH] CONVERT MASTER TO MAIN
echo.
echo This will rename local 'master' to 'main' and push to GitHub.
set /p confirm="Proceed? (y/n): "
if /i not "!confirm!"=="y" goto MENU

git branch -m master main
git push -u origin main
echo.
echo If you want to delete 'master' on GitHub, run: git push origin --delete master
echo RENAME COMPLETE!
pause
goto MENU

:CONFIG
cls
echo [CONFIG] CHANGE REPOSITORY URL
git remote -v
echo.
set /p new_url="Enter New Repository URL: "
if "%new_url%"=="" goto MENU

git remote set-url origin %new_url%
echo URL updated to: %new_url%
pause
goto MENU
