<#
.SYNOPSIS
  Builds MechBazar Android apps locally, with no EAS cloud build.

.DESCRIPTION
  `eas build --local` runs the real EAS build pipeline on this machine. It
  needs a Linux/macOS host, so the build runs inside WSL against a clone of
  this repo on the WSL ext4 filesystem (/root/mechbazar) rather than over
  /mnt/c -- Gradle on a DrvFs mount is slow enough to look hung, and file
  permissions do not survive the crossing.

  Signing comes from each app's credentials.json (credentialsSource: "local"
  in eas.json). Those files and the .keystore files they point at are
  gitignored, so they are copied across explicitly here; without them the
  generated build.gradle falls back to the debug keystore and produces an
  artifact Play rejects and Firebase cannot attest.

.PARAMETER Apps
  Which apps to build. Defaults to the three that ship phone OTP.

.PARAMETER Profile
  EAS build profile: "preview" for an installable APK, "production" for the
  AAB required by Play. Defaults to preview.

.EXAMPLE
  .\build-local.ps1
  .\build-local.ps1 -Apps mobile -Profile production
#>
param(
    [string[]]$Apps = @("mobile", "mechanic", "rider"),
    [ValidateSet("preview", "production")]
    [string]$Profile = "preview",
    [string]$Distro = "Ubuntu",
    [string]$WslRepo = "/root/mechbazar"
)

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot

function Invoke-Wsl {
    param([string]$Command)
    # -lc so the login shell exports ANDROID_HOME/JAVA_HOME from /etc/profile.d.
    wsl -d $Distro -- bash -lc $Command
    if ($LASTEXITCODE -ne 0) { throw "WSL command failed (exit $LASTEXITCODE): $Command" }
}

Write-Host "=== MechBazar local build ===" -ForegroundColor Cyan
Write-Host "apps:    $($Apps -join ', ')"
Write-Host "profile: $Profile"

# Uncommitted work is invisible to the build: EAS archives committed state,
# and the WSL clone pulls over git. Fail loudly rather than silently shipping
# yesterday's code.
$dirty = git -C $repoRoot status --porcelain
if ($dirty) {
    Write-Warning "Working tree has uncommitted changes. They will NOT be in the build:"
    $dirty | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkYellow }
    if ((Read-Host "Continue anyway? (y/N)") -ne "y") { exit 1 }
}

$branch = (git -C $repoRoot branch --show-current).Trim()
Write-Host "`nSyncing $branch into WSL ($WslRepo)..." -ForegroundColor Cyan
Invoke-Wsl "cd $WslRepo && git fetch origin && git checkout $branch && git reset --hard origin/$branch"

foreach ($app in $Apps) {
    $credsWin = Join-Path $repoRoot "apps\$app\credentials.json"
    if (-not (Test-Path $credsWin)) {
        throw "apps/$app/credentials.json is missing. Regenerate it (see docs/LOCAL_BUILDS.md) or the build will be signed with the debug key."
    }

    # Gitignored, so git sync cannot carry these. wslpath keeps the copy honest
    # about the /mnt/c spelling of the Windows path.
    Write-Host "`n[$app] copying signing material..." -ForegroundColor Cyan
    $appWsl = "$WslRepo/apps/$app"
    Invoke-Wsl "cp `"`$(wslpath '$credsWin')`" $appWsl/credentials.json"

    $keystoreName = (Get-Content $credsWin -Raw | ConvertFrom-Json).android.keystore.keystorePath
    $keystoreWin = Join-Path $repoRoot "apps\$app\$keystoreName"
    if (-not (Test-Path $keystoreWin)) { throw "Keystore $keystoreName not found for $app." }
    Invoke-Wsl "cp `"`$(wslpath '$keystoreWin')`" $appWsl/$keystoreName"

    Write-Host "[$app] building ($Profile)... this takes a while" -ForegroundColor Cyan
    # --local keeps the whole build on this machine; --non-interactive so a
    # credential prompt fails fast instead of blocking forever.
    Invoke-Wsl "cd $appWsl && npx eas-cli build --platform android --profile $Profile --local --non-interactive"

    Write-Host "[$app] done." -ForegroundColor Green
}

Write-Host "`nArtifacts are in each app's WSL directory. Copy one out with:" -ForegroundColor Cyan
Write-Host "  wsl -d $Distro -- bash -lc 'cp $WslRepo/apps/<app>/build-*.a[pa][kb] /mnt/c/Users/MechBazar/build-local/'"
