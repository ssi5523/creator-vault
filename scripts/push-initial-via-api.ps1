# Push entire HEAD to empty GitHub repo via api.github.com (when git HTTPS fails)
param(
  [string]$Repo = "ssi5523/creator-vault",
  [string]$Branch = "main",
  [string]$Ref = "HEAD",
  [string]$Parent = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$git = (Get-Command git -ErrorAction SilentlyContinue).Source
if (-not $git) { throw "git not found" }

$commitSha = (& $git rev-parse $Ref).Trim()
$msg = (& $git log -1 --format=%B $commitSha | Out-String).TrimEnd()
Write-Host "Pushing commit $commitSha to $Repo ($Branch)..."

$entries = & $git ls-tree -r $commitSha
$treeItems = @()
$i = 0

foreach ($line in $entries) {
  if ($line -match '^(\d+)\s+(\w+)\s+(\w+)(?:\s+\d+)?\t(.+)$') {
    $mode = $Matches[1]
    $type = $Matches[2]
    $sha = $Matches[3]
    $path = $Matches[4]
  } else {
    throw "Bad ls-tree line: $line"
  }
  if ($type -ne "blob") { continue }

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $git
  $psi.Arguments = "cat-file blob $sha"
  $psi.RedirectStandardOutput = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $p = [Diagnostics.Process]::Start($psi)
  $ms = New-Object IO.MemoryStream
  $p.StandardOutput.BaseStream.CopyTo($ms)
  $p.WaitForExit()
  if ($p.ExitCode -ne 0) { throw "cat-file failed: $path" }

  $b64 = [Convert]::ToBase64String($ms.ToArray())
  $jf = [IO.Path]::GetTempFileName() + ".json"
  [IO.File]::WriteAllText($jf, (@{ content = $b64; encoding = "base64" } | ConvertTo-Json -Compress))
  $blobSha = gh api -X POST "repos/$Repo/git/blobs" --input $jf --jq .sha
  Remove-Item $jf -Force
  $treeItems += @{ path = $path; mode = $mode; type = "blob"; sha = $blobSha }
  $i++
  Write-Host "  [$i] $path"
}

$treeBody = @{ tree = $treeItems } | ConvertTo-Json -Depth 6 -Compress
$treeFile = [IO.Path]::GetTempFileName() + ".json"
[IO.File]::WriteAllText($treeFile, $treeBody, [Text.UTF8Encoding]::new($false))
$treeSha = gh api -X POST "repos/$Repo/git/trees" --input $treeFile --jq .sha
Remove-Item $treeFile -Force
Write-Host "tree: $treeSha"

$commitObj = @{ message = $msg; tree = $treeSha }
if ($Parent) { $commitObj.parents = @($Parent) }
$commitBody = $commitObj | ConvertTo-Json -Depth 4 -Compress
$commitFile = [IO.Path]::GetTempFileName() + ".json"
[IO.File]::WriteAllText($commitFile, $commitBody, [Text.UTF8Encoding]::new($false))
$newCommit = gh api -X POST "repos/$Repo/git/commits" --input $commitFile --jq .sha
Remove-Item $commitFile -Force
Write-Host "commit: $newCommit"

try {
  gh api -X PATCH "repos/$Repo/git/refs/heads/$Branch" -f sha=$newCommit | Out-Null
} catch {
  gh api -X POST "repos/$Repo/git/refs" -f ref="refs/heads/$Branch" -f sha=$newCommit | Out-Null
}

Write-Host "Done: https://github.com/$Repo"
& $git update-ref "refs/remotes/origin/$Branch" $newCommit 2>$null
