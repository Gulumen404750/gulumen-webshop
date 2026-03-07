# Teszt: IP felismerés proxy mögött (X-Forwarded-For)
# Ha a rate limit az X-Forwarded-For első elemét használja, akkor különböző X-Forwarded-For
# = különböző "IP" = különböző számláló. Így 10 hibás login "1.2.3.4"-gyel -> 429,
# ugyanígy 10 hibás "5.6.7.8"-cal -> 429, de 5+5 különböző IP-vel -> mind 401.
# Futtatás: szerver futása mellett.

$baseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { "http://localhost:3000" }
$uri = "$baseUrl/api/auth/login"
$body = '{"email":"wrong@example.com","password":"wrong"}'

Write-Host "=== X-Forwarded-For teszt: kulonbozo header = kulonbozo IP (rate limit szetosztva) ==="

# 5 hibás "IP" 1.2.3.4
$headers1 = @{ "Content-Type" = "application/json"; "X-Forwarded-For" = "1.2.3.4" }
1..5 | ForEach-Object {
  try {
    $r = Invoke-WebRequest -Uri $uri -Method POST -Body $body -Headers $headers1 -UseBasicParsing -ErrorAction Stop
    Write-Host "1.2.3.4 attempt $_ : $($r.StatusCode)"
  } catch {
    Write-Host "1.2.3.4 attempt $_ : $($_.Exception.Response.StatusCode.value__)"
  }
}

# 5 hibás "IP" 5.6.7.8
$headers2 = @{ "Content-Type" = "application/json"; "X-Forwarded-For" = "5.6.7.8" }
1..5 | ForEach-Object {
  try {
    $r = Invoke-WebRequest -Uri $uri -Method POST -Body $body -Headers $headers2 -UseBasicParsing -ErrorAction Stop
    Write-Host "5.6.7.8 attempt $_ : $($r.StatusCode)"
  } catch {
    Write-Host "5.6.7.8 attempt $_ : $($_.Exception.Response.StatusCode.value__)"
  }
}

# Ha az IP a header alapjan van: 1.2.3.4-n most 5 failed van, 5.6.7.8-n is 5. Egyik sem 10 -> egyik sem 429.
# Következő: 5+5 még egymas utan ugyanazzal a ket IP-vel -> most 1.2.3.4 = 10, 5.6.7.8 = 10 -> kovetkezo hivas 429 mindketton.
Write-Host "--- Most 5+5 kulonbozo IP (1.2.3.4 es 5.6.7.8). Kovetkezo 5+5 ugyanezekkel -> 10+10, utana 429. ---"

1..5 | ForEach-Object {
  try {
    $r = Invoke-WebRequest -Uri $uri -Method POST -Body $body -Headers $headers1 -UseBasicParsing -ErrorAction Stop
    Write-Host "1.2.3.4 again $_ : $($r.StatusCode)"
  } catch {
    Write-Host "1.2.3.4 again $_ : $($_.Exception.Response.StatusCode.value__)"
  }
}
# 11. hivas 1.2.3.4-gyel -> 429
try {
  $r = Invoke-WebRequest -Uri $uri -Method POST -Body $body -Headers $headers1 -UseBasicParsing -ErrorAction Stop
  Write-Host "1.2.3.4 11th : $($r.StatusCode) (expected 429)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host "1.2.3.4 11th : $code (expected 429). Body: $($_.ErrorDetails.Message)"
}
# 5.6.7.8-cal meg csak 5 van, 6. hivas -> 401
try {
  $r = Invoke-WebRequest -Uri $uri -Method POST -Body $body -Headers $headers2 -UseBasicParsing -ErrorAction Stop
  Write-Host "5.6.7.8 6th : $($r.StatusCode) (expected 401)"
} catch {
  Write-Host "5.6.7.8 6th : $($_.Exception.Response.StatusCode.value__) (expected 401)"
}

Write-Host "=== Ha 1.2.3.4 11th = 429 es 5.6.7.8 6th = 401, akkor a rendszer tenyleg X-Forwarded-For (elso elem) alapjan kulonboztet. ==="
