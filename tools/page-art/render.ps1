# Renders the itch.io page art with headless Chrome into output/itch-page/.
#   banner-960x300.png / banner-1920x600.png   -> Edit theme > Banner
#   background-1920x1080.png                   -> Edit theme > Background
#   embed-640x360.png                          -> Edit game > Embed options > "Embed background" (itch displays at 1:1 pixel size!)
$here = $PSScriptRoot
$out = Join-Path $here '..\..\output\itch-page'
New-Item -ItemType Directory -Force $out | Out-Null
$out = Resolve-Path $out
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$jobs = @(
  @{ f = 'banner';     w = 960;  h = 300;  s = @(1, 2) },
  @{ f = 'background'; w = 1920; h = 1080; s = @(1) },
  @{ f = 'embed';      w = 640;  h = 360;  s = @(1) }
)
foreach ($j in $jobs) {
  $url = 'file:///' + ((Join-Path $here "$($j.f).html") -replace '\\', '/')
  foreach ($s in $j.s) {
    $name = "$($j.f)-$([int]($j.w * $s))x$([int]($j.h * $s)).png"
    & $chrome --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files `
      --force-device-scale-factor=$s --window-size="$($j.w),$($j.h)" --virtual-time-budget=3000 `
      --screenshot="$out\$name" $url 2>$null | Out-Null
  }
}
Get-ChildItem $out
