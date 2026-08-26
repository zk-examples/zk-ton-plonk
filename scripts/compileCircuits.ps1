$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$compilerVersion = '2.2.3'
$compilerSha256 = 'e43f132ee6f0aa79b705beceb59c2a7e6a54d7bdeab917ca34e9fc1951d185e1'
$compilerUrl = 'https://github.com/iden3/circom/releases/download/v2.2.3/circom-windows-amd64.exe'
$compilerCacheDirectory = Join-Path $repositoryRoot ".cache\circom\v$compilerVersion"
$cachedCompilerPath = Join-Path $compilerCacheDirectory 'circom-windows-amd64.exe'
$compilerPath = if ($env:CIRCOM_BIN) { $env:CIRCOM_BIN } else { $cachedCompilerPath }

function Get-Sha256([string] $path) {
    $stream = [System.IO.File]::OpenRead($path)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([System.BitConverter]::ToString($sha256.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
        $stream.Dispose()
    }
}

if (-not (Test-Path -LiteralPath $compilerPath -PathType Leaf)) {
    if ($env:CIRCOM_BIN) {
        throw "CIRCOM_BIN does not point to a file: $compilerPath"
    }

    New-Item -ItemType Directory -Path $compilerCacheDirectory -Force | Out-Null
    $downloadPath = [System.IO.Path]::GetTempFileName()
    try {
        Write-Host "Downloading official Circom $compilerVersion release..."
        Invoke-WebRequest -Uri $compilerUrl -OutFile $downloadPath
        $downloadHash = Get-Sha256 $downloadPath
        if ($downloadHash -ne $compilerSha256) {
            throw "Downloaded Circom SHA-256 mismatch: $downloadHash"
        }
        Move-Item -LiteralPath $downloadPath -Destination $cachedCompilerPath
    }
    finally {
        Remove-Item -LiteralPath $downloadPath -Force -ErrorAction SilentlyContinue
    }
}

$actualCompilerHash = Get-Sha256 $compilerPath
if ($actualCompilerHash -ne $compilerSha256) {
    throw "Circom SHA-256 mismatch: expected $compilerSha256, got $actualCompilerHash"
}
$actualCompilerVersion = (& $compilerPath --version 2>&1 | Out-String).Trim()
if ($actualCompilerVersion -ne "circom compiler $compilerVersion") {
    throw "Circom version mismatch: expected $compilerVersion, got $actualCompilerVersion"
}

$circuits = @(
    @{ Name = 'condition'; Directory = 'condition' },
    @{ Name = 'fibonacci'; Directory = 'fibonacci' },
    @{ Name = 'multiply_three'; Directory = 'multiply_three' },
    @{ Name = 'PowerABN'; Directory = 'PowerABN' },
    @{ Name = 'Reuse'; Directory = 'Reuse' }
)

foreach ($circuit in $circuits) {
    $circuitDirectory = Join-Path (Join-Path $repositoryRoot 'circuits') $circuit.Directory
    $standardOutput = [System.IO.Path]::GetTempFileName()
    $standardError = [System.IO.Path]::GetTempFileName()

    try {
        $arguments = @(
            ('{0}.circom' -f $circuit.Name),
            '--r1cs',
            '--wasm',
            '--sym',
            '--prime',
            'bls12381',
            '--output=.'
        )
        $compiler = Start-Process `
            -FilePath $compilerPath `
            -ArgumentList $arguments `
            -WorkingDirectory $circuitDirectory `
            -RedirectStandardOutput $standardOutput `
            -RedirectStandardError $standardError `
            -WindowStyle Hidden `
            -Wait `
            -PassThru

        $compilerOutput = Get-Content -LiteralPath $standardOutput -Raw
        $compilerError = Get-Content -LiteralPath $standardError -Raw
        if ($compilerOutput) {
            Write-Host $compilerOutput.TrimEnd()
        }
        if ($compilerError) {
            [Console]::Error.WriteLine($compilerError.TrimEnd())
        }
        if ($compiler.ExitCode -ne 0) {
            throw "circom2 failed for $($circuit.Name) with exit code $($compiler.ExitCode)."
        }
    }
    finally {
        Remove-Item -LiteralPath $standardOutput, $standardError -Force -ErrorAction SilentlyContinue
    }
}
