Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'icons'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

function Add-RoundedRect($path, $x, $y, $w, $h, $r) {
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90) | Out-Null
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90) | Out-Null
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90) | Out-Null
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90) | Out-Null
  $path.CloseFigure() | Out-Null
}

function New-AppIcon([int]$size, [string]$name, [bool]$maskable) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  if ($maskable) {
    $g.SetClip((New-Object System.Drawing.Rectangle(0, 0, $size, $size)))
  } else {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pad = [int]($size * 0.02)
    Add-RoundedRect $path $pad $pad ($size - 2 * $pad) ($size - 2 * $pad) ([int]($size * 0.22))
    $g.SetClip($path)
  }

  $c1 = [System.Drawing.Color]::FromArgb(111, 91, 214)
  $c2 = [System.Drawing.Color]::FromArgb(47, 118, 136)
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.PointF(0, 0)),
    (New-Object System.Drawing.PointF($size, $size)), $c1, $c2)
  $g.FillRectangle($grad, 0, 0, $size, $size)

  # Fruit body
  $scale = if ($maskable) { 0.40 } else { 0.48 }
  $cx = $size / 2
  $cy = $size * 0.56
  $r = $size * $scale / 2
  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
  $g.FillEllipse($white, [float]($cx - $r), [float]($cy - $r), [float]($r * 2), [float]($r * 2))

  # Stem
  $stem = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 236, 228, 255), [Math]::Max(2, [int]($size * 0.018)))
  $stem.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $stem.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($stem, [float]$cx, [float]($cy - $r + $size * 0.01), [float]($cx + $size * 0.015), [float]($cy - $r - $size * 0.075))

  # Leaf (rotated ellipse)
  $state = $g.Save()
  $g.TranslateTransform([float]($cx + $size * 0.055), [float]($cy - $r - $size * 0.085))
  $g.RotateTransform(-28)
  $leaf = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 166, 226, 224))
  $g.FillEllipse($leaf, [float](-$size * 0.10), [float](-$size * 0.045), [float]($size * 0.20), [float]($size * 0.09))
  $g.Restore($state)

  $g.ResetClip()
  $g.Dispose()
  $bmp.Save((Join-Path $outDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Created $name ($size x $size)"
}

New-AppIcon 192 'icon-192.png' $false
New-AppIcon 512 'icon-512.png' $false
New-AppIcon 192 'icon-maskable-192.png' $true
New-AppIcon 512 'icon-maskable-512.png' $true
