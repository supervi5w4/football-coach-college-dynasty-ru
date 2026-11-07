param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet('Install','Restore','Status')]
    [string]$Action,

    [Parameter(Position=1)]
    [string]$GamePath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-Hash([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}

function Find-Game {
    $steam = (Get-ItemProperty -LiteralPath 'HKCU:\Software\Valve\Steam').SteamPath
    $libraries = @($steam)
    $vdf = Join-Path $steam 'steamapps\libraryfolders.vdf'
    if (Test-Path -LiteralPath $vdf) {
        foreach ($match in [regex]::Matches((Get-Content -Raw -LiteralPath $vdf), '"path"\s+"([^"]+)"')) {
            $libraries += $match.Groups[1].Value.Replace('\\', '\')
        }
    }
    foreach ($library in $libraries | Select-Object -Unique) {
        $manifest = Join-Path $library 'steamapps\appmanifest_2151290.acf'
        if (Test-Path -LiteralPath $manifest) {
            $name = [regex]::Match((Get-Content -Raw -LiteralPath $manifest), '"installdir"\s+"([^"]+)"')
            if ($name.Success) {
                $candidate = Join-Path (Join-Path $library 'steamapps\common') $name.Groups[1].Value
                if (Test-Path -LiteralPath (Join-Path $candidate 'FootballCoach.exe') -PathType Leaf) {
                    return $candidate
                }
            }
        }
    }
    throw 'Папка игры не найдена. Укажите её вторым параметром.'
}

function Copy-Part([string]$Path, [IO.Stream]$Output, [long]$Offset = 0) {
    $inputFile = [IO.File]::OpenRead($Path)
    try {
        $inputFile.Position = $Offset
        $inputFile.CopyTo($Output)
    } finally {
        $inputFile.Dispose()
    }
}

$lock = $null
$temp = $null
try {
    $manifest = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'patch.json') | ConvertFrom-Json
    if (-not $GamePath) { $GamePath = Find-Game }
    $root = (Resolve-Path -LiteralPath $GamePath).ProviderPath
    $exe = Join-Path $root 'FootballCoach.exe'
    $archive = Join-Path $root 'resources\app.asar'
    $backup = "$archive.fccd-ru.original"
    if (!(Test-Path -LiteralPath $exe -PathType Leaf) -or !(Test-Path -LiteralPath $archive -PathType Leaf)) {
        throw 'Укажите папку, в которой находятся FootballCoach.exe и resources\app.asar.'
    }
    Write-Host "Папка игры: $root"

    if ($Action -ne 'Status') {
        $running = Get-Process -Name FootballCoach -ErrorAction SilentlyContinue |
            Where-Object { $_.Path -eq $exe -or !$_.Path }
        if ($running) { throw 'Закройте игру перед установкой или откатом.' }
        $lock = [IO.FileStream]::new("$archive.fccd-ru.lock", [IO.FileMode]::OpenOrCreate,
            [IO.FileAccess]::ReadWrite, [IO.FileShare]::None, 1, [IO.FileOptions]::DeleteOnClose)
    }
    $current = Get-Hash $archive
    $previousVersion = $manifest.PSObject.Properties.Name -contains 'previousPatched' -and
        $manifest.previousPatched -contains $current
    $sourceArchive = $archive
    if ($current -eq $manifest.original) {
        Write-Host 'Найдена оригинальная версия 1.6.5 (сборка 19732424).'
        if ($Action -ne 'Install') { exit 0 }
    } elseif ($current -eq $manifest.patched) {
        Write-Host 'Русификатор установлен.'
        if ($Action -ne 'Restore') { exit 0 }
    } elseif ($previousVersion) {
        Write-Host 'Установлена предыдущая версия русификатора.'
        if ($Action -eq 'Status') { exit 0 }
        $sourceArchive = $backup
    } else {
        throw 'Архив игры отличается от поддерживаемой сборки. Возможно, Steam обновил игру или установлен другой мод.'
    }

    $hasBackup = Test-Path -LiteralPath $backup -PathType Leaf
    if ($previousVersion -and !$hasBackup) {
        throw 'Для обновления нужна исходная резервная копия app.asar.fccd-ru.original.'
    }
    if ($hasBackup -and (Get-Hash $backup) -ne $manifest.original) {
        throw 'Резервная копия не прошла проверку SHA-256.'
    }
    $temp = "$archive.fccd-ru.$([guid]::NewGuid().ToString('N')).tmp"
    if ($Action -eq 'Install') {
        $header = Join-Path $PSScriptRoot 'header.bin'
        $tail = Join-Path $PSScriptRoot 'tail.bin'
        if ((Get-Hash $header) -ne $manifest.header -or (Get-Hash $tail) -ne $manifest.tail) {
            throw 'Файлы патча не прошли проверку SHA-256. Распакуйте архив заново.'
        }
        $output = [IO.File]::Open($temp, [IO.FileMode]::CreateNew)
        try {
            Copy-Part $header $output
            Copy-Part $sourceArchive $output $manifest.dataOffset
            Copy-Part $tail $output
            $output.Flush($true)
        } finally {
            $output.Dispose()
        }
        if ((Get-Hash $temp) -ne $manifest.patched -or (Get-Hash $archive) -ne $current) {
            throw 'Проверка архива перед установкой не пройдена.'
        }
        $backupDestination = if ($hasBackup) { [NullString]::Value } else { $backup }
        [IO.File]::Replace($temp, $archive, $backupDestination)
        Write-Host 'Русификатор установлен. Теперь можно запустить игру.'
    } else {
        if (!$hasBackup) { throw 'Резервная копия отсутствует. Восстановите файлы через Steam.' }
        [IO.File]::Copy($backup, $temp)
        if ((Get-Hash $temp) -ne $manifest.original -or (Get-Hash $archive) -ne $current) {
            throw 'Проверка архива перед откатом не пройдена.'
        }
        [IO.File]::Replace($temp, $archive, [NullString]::Value)
        Write-Host 'Оригинальные файлы восстановлены.'
    }
    exit 0
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    if ($temp -and (Test-Path -LiteralPath $temp)) { Remove-Item -LiteralPath $temp -Force }
    if ($lock) { $lock.Dispose() }
}
