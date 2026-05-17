# Push a git commit to GitHub via api.github.com (when github.com HTTPS is blocked)
param(
  [string]$Commit = "dffe718",
  [string]$Parent = "07a3f2e2bd5fa1a3cf5dc9d5a91ba20a3e9b2e3e",
  [string]$Repo = "ssi5523/creator-vault",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"
$git = "D:\Git\cmd\git.exe"
Set-Location "C:\Users\86158\Desktop\4"

$msg = (& $git log -1 --format=%B $Commit | Out-String).TrimEnd()
$files = @(& $git diff-tree --no-commit-id --name-only -r $Commit)

$baseTree = gh api "repos/$Repo/git/commits/$Parent" --jq .tree.sha
Write-Host "base_tree: $baseTree"

$treeItems = @()
foreach ($path in $files) {
  $blobHash = (& $git rev-parse "${Commit}:${path}").Trim()
  $tmp = [IO.Path]::GetTempFileName()
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $git
  $psi.Arguments = "cat-file blob $blobHash"
  $psi.RedirectStandardOutput = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $p = [Diagnostics.Process]::Start($psi)
  $ms = New-Object IO.MemoryStream
  $p.StandardOutput.BaseStream.CopyTo($ms)
  $p.WaitForExit()
  if ($p.ExitCode -ne 0) { throw "cat-file failed: $path" }
  $bytes = $ms.ToArray()
  $b64 = [Convert]::ToBase64String($bytes)
  $blobSha = gh api -X POST "repos/$Repo/git/blobs" -f "content=$b64" -f encoding=base64 --jq .sha
  Write-Host "  $path -> $blobSha"
  $treeItems += @{ path = $path; mode = "100644"; type = "blob"; sha = $blobSha }
}

$treeBody = @{ base_tree = $baseTree; tree = $treeItems } | ConvertTo-Json -Depth 6
$treeFile = [IO.Path]::GetTempFileName() + ".json"
[IO.File]::WriteAllText($treeFile, $treeBody, [Text.UTF8Encoding]::new($false))
$treeSha = gh api -X POST "repos/$Repo/git/trees" --input $treeFile --jq .sha
Remove-Item $treeFile
Write-Host "tree: $treeSha"

$commitBody = @{ message = $msg; tree = $treeSha; parents = @($Parent) } | ConvertTo-Json -Depth 4
$commitFile = [IO.Path]::GetTempFileName() + ".json"
[IO.File]::WriteAllText($commitFile, $commitBody, [Text.UTF8Encoding]::new($false))
$newCommit = gh api -X POST "repos/$Repo/git/commits" --input $commitFile --jq .sha
Remove-Item $commitFile
Write-Host "commit: $newCommit"

gh api -X PATCH "repos/$Repo/git/refs/heads/$Branch" -f sha=$newCommit | Out-Null
Write-Host "Pushed $Branch -> $newCommit"

& $git update-ref refs/remotes/origin/main $newCommit 2>$null
& $git reset --soft $newCommit 2>$null
