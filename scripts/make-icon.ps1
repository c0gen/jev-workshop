Add-Type -AssemblyName System.Drawing
$assetDirectory = Join-Path $PSScriptRoot '..\resources'
New-Item -ItemType Directory -Path $assetDirectory -Force | Out-Null
$bitmap = [System.Drawing.Bitmap]::new(256, 256)
$canvas = [System.Drawing.Graphics]::FromImage($bitmap)
$canvas.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$canvas.Clear([System.Drawing.Color]::FromArgb(25, 48, 35))
$pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(164, 212, 181), 12)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$flask = [System.Drawing.Drawing2D.GraphicsPath]::new()
$flask.AddLines([System.Drawing.PointF[]]@([System.Drawing.PointF]::new(105, 55), [System.Drawing.PointF]::new(105, 108), [System.Drawing.PointF]::new(67, 181)))
$flask.AddBezier(67,181,60,195,65,204,82,204)
$flask.AddLine(82,204,174,204)
$flask.AddBezier(174,204,191,204,196,195,189,181)
$flask.AddLine(189,181,151,108)
$flask.AddLine(151,108,151,55)
$canvas.DrawPath($pen, $flask)
$canvas.DrawLine($pen, 96, 55, 160, 55)
$canvas.DrawLine($pen, 94, 151, 162, 151)
$dotBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(164, 212, 181))
$canvas.FillEllipse($dotBrush, 110, 168, 10, 10)
$canvas.FillEllipse($dotBrush, 141, 179, 7, 7)
$stream = [System.IO.MemoryStream]::new()
$bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
$png = $stream.ToArray()
[System.IO.File]::WriteAllBytes((Join-Path $assetDirectory 'icon.png'), $png)
$iconStream = [System.IO.File]::Create((Join-Path $assetDirectory 'icon.ico'))
$writer = [System.IO.BinaryWriter]::new($iconStream)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
$writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
$writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$png.Length); $writer.Write([uint32]22)
$writer.Write($png)
$writer.Dispose(); $stream.Dispose(); $flask.Dispose(); $pen.Dispose(); $dotBrush.Dispose(); $canvas.Dispose(); $bitmap.Dispose()
