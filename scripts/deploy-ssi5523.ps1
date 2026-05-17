# Deploy DeFiVault to ssi5523 GitHub + GitHub Pages
# Run in PowerShell from project root after: gh auth login -h github.com -p https -w -s repo

$ErrorActionPreference = "Stop"
$Owner = "ssi5523"
$Repo = "creator-vault"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "=== DeFiVault -> $Owner/$Repo ===" -ForegroundColor Cyan

$login = gh auth status 2>&1 | Out-String
if ($login -notmatch "Logged in") {
  Write-Host "Please login first:" -ForegroundColor Yellow
  Write-Host "  gh auth login -h github.com -p https -w -s repo"
  Write-Host "Sign in as $Owner in the browser."
  exit 1
}

$null = gh repo view "$Owner/$Repo" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Creating public repo $Owner/$Repo ..."
  gh repo create "$Owner/$Repo" --public --description "DeFiVault - TokenCore DeFi self-custody wallet"
}

git remote set-url origin "https://github.com/$Owner/$Repo.git"
Write-Host "Pushing main branch..."
git push -u origin main

Write-Host "Building and pushing gh-pages..."
npm run deploy:china

Write-Host ""
Write-Host "Done! Enable Pages if first time:" -ForegroundColor Green
Write-Host "  https://github.com/$Owner/$Repo/settings/pages"
Write-Host "  Branch: gh-pages  Folder: / (root)"
Write-Host ""
Write-Host "Site URL: https://$Owner.github.io/$Repo/" -ForegroundColor Green
