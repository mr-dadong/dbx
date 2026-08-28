[CmdletBinding()]
param(
  [string]$SdkVersion = "1.0.902.49",
  [string]$SdkPackageSha256 = "b483c906b03690267108f4304d456eac0e718131ef994e69aaa5a21532b512c6",
  [string]$StaticLoaderSha256 = "aa5c26670f1b18d0fa2a56ac3f1ae30110c332a8bfbd555a7be3e548d1b0da3d",
  [string]$DynamicLoaderSha256 = "fdf978ba706578b05967d7f0181f462147864a5aa74f36016a62cb3d3dbe6909",
  [string]$ProbeDirectory = (Join-Path ([System.IO.Path]::GetTempPath()) "dbx-server2012-webview2-loader-probe"),
  [switch]$InstallStaticLoader
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Server 2012 R2 对 WebView2 Loader 的行为与 Windows 7 不同，因此使用独立版本，
# 并且必须先经过 Server 2012 R2 实机探测，不能复用 Win7 构建的验证结论。
$webView2ComSysVersion = "0.38.2"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) "dbx-server2012-webview2-loader-$([Guid]::NewGuid())"
$packagePath = Join-Path $temporaryRoot "Microsoft.Web.WebView2.$SdkVersion.nupkg"
$extractedPath = Join-Path $temporaryRoot "extracted"

try {
  New-Item -ItemType Directory -Path $extractedPath -Force | Out-Null
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

  $packageUrl = "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/$SdkVersion"
  Invoke-WebRequest -Uri $packageUrl -OutFile $packagePath -UseBasicParsing

  $actualPackageSha256 = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualPackageSha256 -ne $SdkPackageSha256) {
    throw "Unexpected WebView2 SDK package SHA256: $actualPackageSha256"
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($packagePath, $extractedPath)

  $staticLoader = Join-Path $extractedPath "build/native/x64/WebView2LoaderStatic.lib"
  $dynamicLoader = Join-Path $extractedPath "build/native/x64/WebView2Loader.dll"
  foreach ($loader in @($staticLoader, $dynamicLoader)) {
    if (!(Test-Path -LiteralPath $loader -PathType Leaf)) {
      throw "WebView2 SDK $SdkVersion does not contain the required loader: $loader"
    }
  }

  $actualStaticSha256 = (Get-FileHash -LiteralPath $staticLoader -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualStaticSha256 -ne $StaticLoaderSha256) {
    throw "Unexpected Server 2012 R2 static loader SHA256: $actualStaticSha256"
  }
  $actualDynamicSha256 = (Get-FileHash -LiteralPath $dynamicLoader -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualDynamicSha256 -ne $DynamicLoaderSha256) {
    throw "Unexpected Server 2012 R2 dynamic loader SHA256: $actualDynamicSha256"
  }

  if (Test-Path -LiteralPath $ProbeDirectory) {
    Remove-Item -LiteralPath $ProbeDirectory -Recurse -Force
  }
  New-Item -ItemType Directory -Path $ProbeDirectory -Force | Out-Null
  Copy-Item -LiteralPath $dynamicLoader -Destination (Join-Path $ProbeDirectory "WebView2Loader.dll") -Force

  if ($InstallStaticLoader) {
    Push-Location $repositoryRoot
    try {
      & cargo fetch --locked --target x86_64-win7-windows-msvc
      if ($LASTEXITCODE -ne 0) {
        throw "cargo fetch failed while preparing the Server 2012 R2 loader."
      }

      $metadataJson = & cargo metadata --locked --format-version 1
      if ($LASTEXITCODE -ne 0) {
        throw "cargo metadata failed while locating webview2-com-sys."
      }
    }
    finally {
      Pop-Location
    }

    $metadata = $metadataJson | ConvertFrom-Json
    $packages = @($metadata.packages | Where-Object {
        $_.name -eq "webview2-com-sys" -and $_.version -eq $webView2ComSysVersion
      })
    if ($packages.Count -ne 1) {
      throw "Expected exactly one webview2-com-sys $webView2ComSysVersion package, found $($packages.Count)."
    }

    $crateRoot = Split-Path -Parent $packages[0].manifest_path
    $loaderDestination = Join-Path $crateRoot "x64/WebView2LoaderStatic.lib"
    if (!(Test-Path -LiteralPath $loaderDestination -PathType Leaf)) {
      throw "webview2-com-sys static loader does not exist: $loaderDestination"
    }

    Set-ItemProperty -LiteralPath $loaderDestination -Name IsReadOnly -Value $false
    Copy-Item -LiteralPath $staticLoader -Destination $loaderDestination -Force

    $installedSha256 = (Get-FileHash -LiteralPath $loaderDestination -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($installedSha256 -ne $StaticLoaderSha256) {
      throw "Server 2012 R2 WebView2 loader replacement failed: $installedSha256"
    }
  }

  Write-Host "Prepared Server 2012 R2 WebView2 SDK loader $SdkVersion at $ProbeDirectory"
}
finally {
  if (Test-Path -LiteralPath $temporaryRoot) {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
  }
}
