# Teszt 2: Sourcing oversell race (2 párhuzamos, maxOrders=1 vagy utolsó slot)
# Futtasd: localhost:3000 + DATABASE_URL futása mellett.
# Concurrency: Start-Job (ket kulon runspace, parhuzamos hivas). Opcionalis: PS 7+ -UseParallel -> ForEach-Object -Parallel (meg szorosabb race).

$baseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { "http://localhost:3000" }
$productId = if ($env:TEST_PRODUCT_ID) { $env:TEST_PRODUCT_ID } else { "sd-race-1" }
$useParallel = $env:USE_PARALLEL -eq "1"   # PowerShell 7+: igazabol egyszerre indul a 2 kérés

$uri = "$baseUrl/api/checkout"
$payloads = @(
  (@{ items = @(@{ productId = $productId; qty = 1 }); customer = @{ email = "race1@test.com"; name = "Race1" } } | ConvertTo-Json -Depth 5),
  (@{ items = @(@{ productId = $productId; qty = 1 }); customer = @{ email = "race2@test.com"; name = "Race2" } } | ConvertTo-Json -Depth 5)
)

Write-Host "=== Sourcing race teszt: 2 parhuzamos POST /api/checkout productId=$productId (UseParallel=$useParallel) ==="

if ($useParallel -and $PSVersionTable.PSVersion.Major -ge 7) {
  $results = $payloads | ForEach-Object -Parallel {
    $u = $using:uri
    $b = $_
    try {
      $r = Invoke-WebRequest -Uri $u -Method POST -ContentType "application/json" -Body $b -UseBasicParsing -ErrorAction Stop
      [pscustomobject]@{ code = $r.StatusCode; body = $r.Content }
    } catch {
      [pscustomobject]@{ code = $_.Exception.Response.StatusCode.value__; body = $_.ErrorDetails.Message }
    }
  }
  $res1 = $results[0]
  $res2 = $results[1]
} else {
  $job1 = Start-Job -ScriptBlock {
    param($u, $b)
    try {
      $r = Invoke-WebRequest -Uri $u -Method POST -ContentType "application/json" -Body $b -UseBasicParsing -ErrorAction Stop
      return @{ code = $r.StatusCode; body = $r.Content }
    } catch {
      return @{ code = $_.Exception.Response.StatusCode.value__; body = $_.ErrorDetails.Message }
    }
  } -ArgumentList $uri, $payloads[0]
  $job2 = Start-Job -ScriptBlock {
    param($u, $b)
    try {
      $r = Invoke-WebRequest -Uri $u -Method POST -ContentType "application/json" -Body $b -UseBasicParsing -ErrorAction Stop
      return @{ code = $r.StatusCode; body = $r.Content }
    } catch {
      return @{ code = $_.Exception.Response.StatusCode.value__; body = $_.ErrorDetails.Message }
    }
  } -ArgumentList $uri, $payloads[1]
  Wait-Job $job1, $job2
  $res1 = Receive-Job $job1
  $res2 = Receive-Job $job2
  Remove-Job $job1, $job2
}

Write-Host "Response 1: HTTP $($res1.code) - $($res1.body)"
Write-Host "Response 2: HTTP $($res2.code) - $($res2.body)"
$ok200 = ($res1.code -eq 200 -or $res2.code -eq 200)
$ok409 = ($res1.body -match "Sold out" -or $res2.body -match "Sold out") -or ($res1.code -eq 409 -or $res2.code -eq 409)
if ($ok200 -and $ok409) { Write-Host "PASS: 1x 200, 1x 409 Sold out" } else { Write-Host "CHECK: Elvárt 1x 200 és 1x 409 (Sold out)" }
Write-Host "DB: ProductReservation táblában productId=$productId -> csak 1 aktív (RESERVED/PAID) legyen."
