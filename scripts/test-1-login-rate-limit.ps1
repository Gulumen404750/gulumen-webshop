# Teszt 1: Login rate limit
# Futtasd: localhost:3000 futása mellett.
# Kimenet: konzol + opcionálisan LOG_FILE környezeti változó által megadott fájl.

$baseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { "http://localhost:3000" }
$logFile = $env:LOG_FILE

function Log {
  param([string]$msg)
  Write-Host $msg
  if ($logFile) { Add-Content -Path $logFile -Value $msg }
}

Log "=== Login rate limit teszt (10 hibás -> 429) === Base: $baseUrl"
$uri = "$baseUrl/api/auth/login"
$body = '{"email":"wrong@example.com","password":"wrong"}'

# 1-10: 401
for ($i = 1; $i -le 10; $i++) {
  try {
    $r = Invoke-WebRequest -Uri $uri -Method POST -ContentType "application/json" -Body $body -UseBasicParsing -ErrorAction Stop
    Log "Attempt $i : $($r.StatusCode) (expected 401)"
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    $content = ""
    if ($_.ErrorDetails.Message) { $content = $_.ErrorDetails.Message }
    Log "Attempt $i : $code $content (expected 401)"
  }
}

# 11: 429 + "Too many login attempts"
try {
  $r11 = Invoke-WebRequest -Uri $uri -Method POST -ContentType "application/json" -Body $body -UseBasicParsing -ErrorAction Stop
  Log "Attempt 11 : $($r11.StatusCode) BODY: $($r11.Content) (expected 429 + Too many login attempts)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  $content = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { "" }
  Log "Attempt 11 : $code BODY: $content (expected 429)"
  if ($content -match "Too many login attempts") {
    Log "PASS: 429 body contains 'Too many login attempts. Try again later.'"
  }
}

Log "=== Szerver logban keresendő: 'Login rate limit exceeded' (pino warn) ==="
