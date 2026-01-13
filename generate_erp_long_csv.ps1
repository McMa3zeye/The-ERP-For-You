$ErrorActionPreference = "Stop"

# Run from this project folder
Set-Location $PSScriptRoot

$src   = Join-Path $PSScriptRoot "erp_ideas_by_page.csv"
$fixed = Join-Path $PSScriptRoot "erp_ideas_by_page_fixed.csv"
$long  = Join-Path $PSScriptRoot "erp_ideas_long.csv"

if (!(Test-Path $src)) {
  throw "Source CSV not found: $src"
}

# The matrix CSV was generated with backslash-escaped quotes (\") in cells.
# LibreOffice often tolerates it, but standard CSV parsers do not.
# Convert it to standard CSV quoting by replacing \" -> "
$raw = Get-Content -Path $src -Raw
$raw = $raw -replace '\\\"', '"'

# Write fixed copy (do NOT overwrite the source, since it may be open/locked)
$raw | Out-File -FilePath $fixed -Encoding utf8 -NoNewline

# Convert matrix -> long format: columns are pages, cells are ideas
$rows = Import-Csv -Path $fixed
$out = foreach ($r in $rows) {
  foreach ($p in $r.PSObject.Properties) {
    $val = $p.Value
    if ($null -ne $val -and $val.ToString().Trim() -ne "") {
      [pscustomobject]@{
        page = $p.Name
        idea = $val
      }
    }
  }
}

$out | Export-Csv -Path $long -NoTypeInformation -Encoding UTF8

Write-Host "Wrote: $fixed"
Write-Host "Wrote: $long"


