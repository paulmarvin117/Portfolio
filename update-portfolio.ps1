# update-portfolio.ps1
# Brings the portfolio repo up to date and pushes it to GitHub.
#
# What it does:
#   1. (optional) copies the newest index.html, style.css, script.js from a folder you name
#   2. flattens search-api\search-api into search-api
#   3. sets FORMSPREE_ID and SEARCH_API in script.js
#   4. commits and pushes everything to the main branch
#
# Run it from PowerShell:
#   .\update-portfolio.ps1 -FormspreeId "xyzabcde"
#   .\update-portfolio.ps1 -FormspreeId "xyzabcde" -Source "C:\Users\paulm\Downloads"

param(
    [string]$Repo = "C:\Users\paulm\Desktop\Projects\Web Applications\portfolio",
    [string]$Source = "",
    [string]$FormspreeId = "",
    [string]$SearchApi = "https://portfolio-search-fcayaag9fbeufpfd.southafricanorth-01.azurewebsites.net/api/search",
    [string]$Message = "Update portfolio"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Repo)) { throw "Repo folder not found: $Repo" }
Set-Location $Repo

if (-not (Test-Path ".git")) { throw "This folder is not a git repository: $Repo" }

# 1. Copy newer site files in, if a source folder was given
if ($Source -ne "") {
    if (-not (Test-Path $Source)) { throw "Source folder not found: $Source" }
    foreach ($name in @("index.html", "style.css", "script.js")) {
        $from = Join-Path $Source $name
        if (Test-Path $from) {
            Copy-Item $from (Join-Path $Repo $name) -Force
            Write-Host "Copied $name"
        } else {
            Write-Host "Skipped $name (not in source folder)"
        }
    }
}

# 2. Flatten search-api\search-api into search-api
$outer = Join-Path $Repo "search-api"
$inner = Join-Path $outer "search-api"
if (Test-Path $inner) {
    Get-ChildItem -Path $inner -Force | ForEach-Object {
        $target = Join-Path $outer $_.Name
        if (Test-Path $target) { Remove-Item $target -Recurse -Force }
        Move-Item $_.FullName $target
    }
    Remove-Item $inner -Force
    Write-Host "Flattened search-api folder"
}

# 3. Set the two settings in script.js
$scriptPath = Join-Path $Repo "script.js"
if (-not (Test-Path $scriptPath)) { throw "script.js not found in $Repo" }
$text = [System.IO.File]::ReadAllText($scriptPath)

if ($FormspreeId -ne "") {
    $text = [regex]::Replace($text, "var FORMSPREE_ID = '[^']*';", "var FORMSPREE_ID = '$FormspreeId';")
}
if ($SearchApi -ne "") {
    $text = [regex]::Replace($text, "var SEARCH_API = '[^']*';", "var SEARCH_API = '$SearchApi';")
}
[System.IO.File]::WriteAllText($scriptPath, $text, (New-Object System.Text.UTF8Encoding($false)))

if ($text -match "var FORMSPREE_ID = '';") {
    Write-Warning "FORMSPREE_ID is still empty. The contact form and booking will not send until you set it."
}

# 4. Commit and push
git branch -M main
git add -A

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "Nothing new to commit."
} else {
    git commit -m $Message
}

if (-not (git remote)) {
    git remote add origin https://github.com/paulmarvin117/Portfolio.git
}
git push -u origin main

Write-Host ""
Write-Host "Done. GitHub Pages will update in a minute or two:"
Write-Host "https://paulmarvin117.github.io/Portfolio/"