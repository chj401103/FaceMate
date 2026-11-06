# 가짜 카메라용 영상(face.y4m)을 만들어요. 얼굴 사진 한 장을 4:3 화면 가운데에 놓고 30프레임으로 반복합니다.
# 사용: powershell -File e2e/make-fake-camera.ps1 [얼굴사진.jpg]
param([string]$Photo = (Join-Path $PSScriptRoot '..\public\faces\smile-elder.jpg'))
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.IO; using System.Drawing; using System.Drawing.Imaging; using System.Text;
public static class Y4M {
  public static void Make(string jpg, string outPath, int frames) {
    int W = 640, H = 480;
    using (var src = new Bitmap(jpg))
    using (var canvas = new Bitmap(W, H, PixelFormat.Format24bppRgb)) {
      using (var g = Graphics.FromImage(canvas)) {
        g.Clear(Color.White);
        g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
        g.DrawImage(src, (W - H) / 2, 0, H, H);
      }
      var rect = new Rectangle(0, 0, W, H);
      var bd = canvas.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
      byte[] rgb = new byte[bd.Stride * H];
      System.Runtime.InteropServices.Marshal.Copy(bd.Scan0, rgb, 0, rgb.Length);
      int stride = bd.Stride; canvas.UnlockBits(bd);
      byte[] Y = new byte[W * H]; byte[] U = new byte[W * H / 4]; byte[] V = new byte[W * H / 4];
      for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) {
        int i = y * stride + x * 3; int b = rgb[i], gg = rgb[i + 1], r = rgb[i + 2];
        Y[y * W + x] = (byte)Math.Max(0, Math.Min(255, (int)(0.299 * r + 0.587 * gg + 0.114 * b)));
      }
      for (int y = 0; y < H / 2; y++) for (int x = 0; x < W / 2; x++) {
        double ur = 0, vr = 0;
        for (int dy = 0; dy < 2; dy++) for (int dx = 0; dx < 2; dx++) {
          int i = (y * 2 + dy) * stride + (x * 2 + dx) * 3; int b = rgb[i], gg = rgb[i + 1], r = rgb[i + 2];
          ur += -0.169 * r - 0.331 * gg + 0.5 * b + 128; vr += 0.5 * r - 0.419 * gg - 0.081 * b + 128;
        }
        U[y * (W / 2) + x] = (byte)Math.Max(0, Math.Min(255, (int)(ur / 4)));
        V[y * (W / 2) + x] = (byte)Math.Max(0, Math.Min(255, (int)(vr / 4)));
      }
      using (var fs = new FileStream(outPath, FileMode.Create)) {
        var head = Encoding.ASCII.GetBytes("YUV4MPEG2 W" + W + " H" + H + " F30:1 Ip A1:1 C420jpeg\n");
        fs.Write(head, 0, head.Length);
        var fr = Encoding.ASCII.GetBytes("FRAME\n");
        for (int k = 0; k < frames; k++) { fs.Write(fr, 0, fr.Length); fs.Write(Y, 0, Y.Length); fs.Write(U, 0, U.Length); fs.Write(V, 0, V.Length); }
      }
    }
  }
}
'@
[Y4M]::Make((Resolve-Path $Photo).Path, (Join-Path $PSScriptRoot 'face.y4m'), 30)
Write-Output "만들었어요: $(Join-Path $PSScriptRoot 'face.y4m')"
