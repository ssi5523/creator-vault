# Switch GitHub owner for remote + docs
# Usage: .\scripts\switch-github-account.ps1 -Owner "username" [-RepoName "creator-vault"]
param(
  [Parameter(Mandatory = $true)]
  [string]$Owner,
  [string]$RepoName = "creator-vault"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$oldOwners = @("zxc6778", "asd6666667", "YOUR_USERNAME")
$remote = "https://github.com/$Owner/$RepoName.git"
$pages = "https://$Owner.github.io/$RepoName/"
$repoPath = "$Owner/$RepoName"

Write-Host "Switching GitHub owner -> $Owner"
git remote set-url origin $remote

$files = @(
  "README.md",
  "public\china-url.txt",
  "scripts\deploy-gh-pages.mjs",
  "scripts\push-via-api.ps1",
  "scripts\push-initial-via-api.ps1",
  ".cursor\rules\dual-region-deploy.mdc",
  ".cursor\rules\imtoken-submission-template.mdc"
)

foreach ($rel in $files) {
  $path = Join-Path $root $rel
  if (-not (Test-Path $path)) { continue }
  $text = Get-Content $path -Raw -Encoding UTF8
  foreach ($old in $oldOwners) {
    if ($old -eq $Owner) { continue }
    $text = $text.Replace("https://$old.github.io/$RepoName/", $pages)
    $text = $text.Replace("https://github.com/$old/$RepoName", "https://github.com/$Owner/$RepoName")
    $text = $text.Replace("$old/$RepoName", $repoPath)
  }
  [IO.File]::WriteAllText($path, $text)
  Write-Host "  updated $rel"
}

[IO.File]::WriteAllText((Join-Path $root ".github-owner"), $Owner)
Write-Host "Remote: $remote"
Write-Host "Pages:  $pages"
Write-Host "Run: gh auth login -h github.com -p https -w -s repo"
