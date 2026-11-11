# Renders cover.html to output/cover-630x500.png and output/cover-1260x1000.png (2x, sharper) with headless Chrome.
$here = $PSScriptRoot
$out = Join-Path $here '..\..\output' | Resolve-Path
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$url = 'file:///' + ((Join-Path $here 'cover.html') -replace '\\', '/')
foreach ($v in '', 'nobeer') {
  foreach ($s in 1, 2) {
    $w = 630 * $s; $h = 500 * $s
    $name = if ($v) { "cover-$v-${w}x$h.png" } else { "cover-${w}x$h.png" }
    & $chrome --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files `
      --force-device-scale-factor=$s --window-size=630,500 --virtual-time-budget=3000 `
      --screenshot="$out\$name" ($url + $(if ($v) { "?$v" } else { '' })) 2>$null | Out-Null
  }
}
Get-ChildItem "$out\cover-*.png"
