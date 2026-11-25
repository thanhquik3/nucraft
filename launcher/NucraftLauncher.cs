using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("NUCRAFT")]
[assembly: AssemblyDescription("NUCRAFT PC App (BUILD v124)")]
[assembly: AssemblyProduct("NUCRAFT")]
[assembly: AssemblyVersion("1.0.124.0")]
[assembly: AssemblyFileVersion("1.0.124.0")]

namespace NUCRAFTLauncher
{
    internal static class Program
    {
        private const int PreferredPort = 4173;
        private const string BuildId = "v124";
        private const string EmbeddedZipName = "NUCRAFT_Web_Host.zip";
        private const string EmbeddedIconName = "nucraft.ico";

        private static bool LoadEmbeddedBundle(out Dictionary<string, byte[]> assets, out string bundleHash)
        {
            assets = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
            bundleHash = "";
            Assembly asm = Assembly.GetExecutingAssembly();
            using (Stream resStream = asm.GetManifestResourceStream(EmbeddedZipName))
            {
                if (resStream == null) return false;
                byte[] zipBytes;
                using (MemoryStream ms = new MemoryStream())
                {
                    resStream.CopyTo(ms);
                    zipBytes = ms.ToArray();
                }
                if (zipBytes.Length == 0) return false;
                using (SHA256 sha = SHA256.Create())
                {
                    byte[] digest = sha.ComputeHash(zipBytes);
                    StringBuilder sb = new StringBuilder(12);
                    for (int i = 0; i < 6 && i < digest.Length; i++)
                    {
                        sb.Append(digest[i].ToString("x2"));
                    }
                    bundleHash = sb.ToString();
                }
                using (MemoryStream zipMs = new MemoryStream(zipBytes, false))
                using (ZipArchive zip = new ZipArchive(zipMs, ZipArchiveMode.Read))
                {
                    for (int i = 0; i < zip.Entries.Count; i++)
                    {
                        ZipArchiveEntry entry = zip.Entries[i];
                        string rel = NormalizePath(entry.FullName);
                        if (string.IsNullOrEmpty(rel) || entry.FullName.EndsWith("/") || entry.FullName.EndsWith("\\")) continue;
                        using (Stream es = entry.Open())
                        using (MemoryStream itemMs = new MemoryStream())
                        {
                            es.CopyTo(itemMs);
                            assets[rel] = itemMs.ToArray();
                        }
                    }
                }
            }

            if (!assets.ContainsKey("favicon.ico"))
            {
                using (Stream icoStream = asm.GetManifestResourceStream(EmbeddedIconName))
                {
                    if (icoStream != null)
                    {
                        using (MemoryStream icoMs = new MemoryStream())
                        {
                            icoStream.CopyTo(icoMs);
                            if (icoMs.Length > 0) assets["favicon.ico"] = icoMs.ToArray();
                        }
                    }
                }
            }

            return assets.Count > 0 && (assets.ContainsKey("NUCRAFT.html") || assets.ContainsKey("index.html"));
        }

        private static string NormalizePath(string raw)
        {
            if (string.IsNullOrEmpty(raw)) return "";
            string p = raw.Replace('\\', '/').TrimStart('/');
            return p;
        }

        private static string GetMimeType(string relPath)
        {
            string ext = Path.GetExtension(relPath);
            if (string.IsNullOrEmpty(ext)) return "application/octet-stream";
            switch (ext.ToLowerInvariant())
            {
                case ".html": return "text/html; charset=utf-8";
                case ".js":
                case ".mjs": return "application/javascript; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".glb": return "model/gltf-binary";
                case ".ogg": return "audio/ogg";
                case ".mp3": return "audio/mpeg";
                case ".png": return "image/png";
                case ".webp": return "image/webp";
                case ".jpg":
                case ".jpeg": return "image/jpeg";
                case ".svg": return "image/svg+xml";
                case ".ico": return "image/x-icon";
                case ".wasm": return "application/wasm";
                case ".webmanifest": return "application/manifest+json";
                default: return "application/octet-stream";
            }
        }

        private static bool IsImmutableAsset(string relPath)
        {
            return relPath.StartsWith("assets/models/", StringComparison.OrdinalIgnoreCase)
                || relPath.StartsWith("assets/luanti_sounds/", StringComparison.OrdinalIgnoreCase);
        }

        private sealed class EmbeddedHttpServer : IDisposable
        {
            private readonly Dictionary<string, byte[]> _assets;
            private readonly string _bundleHash;
            private readonly TcpListener _listener;
            private Thread _acceptThread;
            private volatile bool _running;
            private volatile bool _shutdownRequested;
            private volatile bool _byeReceived;
            private long _lastActivityTicks;
            private long _lastByeTicks;

            public int Port { get; private set; }
            public bool ShutdownRequested { get { return _shutdownRequested; } }
            public bool ByeReceived { get { return _byeReceived; } }
            public DateTime LastActivityUtc { get { return new DateTime(Interlocked.Read(ref _lastActivityTicks), DateTimeKind.Utc); } }
            public DateTime LastByeUtc { get { return new DateTime(Interlocked.Read(ref _lastByeTicks), DateTimeKind.Utc); } }

            public EmbeddedHttpServer(Dictionary<string, byte[]> assets, string bundleHash, int port)
            {
                _assets = assets;
                _bundleHash = bundleHash;
                _listener = new TcpListener(IPAddress.Loopback, port);
                _listener.Start(64);
                Port = ((IPEndPoint)_listener.LocalEndpoint).Port;
                long nowTicks = DateTime.UtcNow.Ticks;
                Interlocked.Exchange(ref _lastActivityTicks, nowTicks);
                Interlocked.Exchange(ref _lastByeTicks, 0);
                _running = true;
                _acceptThread = new Thread(AcceptLoop);
                _acceptThread.IsBackground = true;
                _acceptThread.Name = "NUCRAFT_HTTP";
                _acceptThread.Start();
            }

            private void TouchActivity()
            {
                Interlocked.Exchange(ref _lastActivityTicks, DateTime.UtcNow.Ticks);
            }

            private void AcceptLoop()
            {
                while (_running)
                {
                    TcpClient client = null;
                    try
                    {
                        client = _listener.AcceptTcpClient();
                        ThreadPool.QueueUserWorkItem(HandleClient, client);
                    }
                    catch
                    {
                        if (client != null)
                        {
                            try { client.Close(); } catch { }
                        }
                        if (!_running) break;
                    }
                }
            }

            private void HandleClient(object state)
            {
                TcpClient client = (TcpClient)state;
                try
                {
                    client.NoDelay = true;
                    client.ReceiveTimeout = 15000;
                    client.SendTimeout = 15000;
                    using (NetworkStream stream = client.GetStream())
                    {
                        byte[] readBuf = new byte[4096];
                        int bufLen = 0;
                        byte[] buf = new byte[16384];

                        for (int reqCount = 0; reqCount < 128 && _running; reqCount++)
                        {
                            int headerEnd = FindHeaderEnd(buf, bufLen);
                            while (headerEnd < 0)
                            {
                                if (bufLen >= buf.Length)
                                {
                                    WriteSimple(stream, 431, "Request Header Fields Too Large", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Header too large"), true);
                                    return;
                                }
                                int n;
                                try
                                {
                                    n = stream.Read(readBuf, 0, Math.Min(readBuf.Length, buf.Length - bufLen));
                                }
                                catch
                                {
                                    return;
                                }
                                if (n <= 0) return;
                                Buffer.BlockCopy(readBuf, 0, buf, bufLen, n);
                                bufLen += n;
                                headerEnd = FindHeaderEnd(buf, bufLen);
                            }

                            string headerText = Encoding.ASCII.GetString(buf, 0, headerEnd);
                            int bodyOffset = headerEnd + 4;
                            int remaining = bufLen - bodyOffset;
                            if (remaining > 0)
                            {
                                Buffer.BlockCopy(buf, bodyOffset, buf, 0, remaining);
                            }
                            bufLen = remaining;

                            string[] lines = headerText.Split(new[] { "\r\n" }, StringSplitOptions.None);
                            if (lines.Length == 0) return;
                            string[] reqParts = lines[0].Split(' ');
                            if (reqParts.Length < 2) return;

                            string method = reqParts[0].ToUpperInvariant();
                            string rawTarget = reqParts[1];
                            string version = reqParts.Length >= 3 ? reqParts[2].ToUpperInvariant() : "HTTP/1.1";

                            bool closeConn = version == "HTTP/1.0";
                            string ifNoneMatch = null;
                            int contentLength = 0;
                            for (int i = 1; i < lines.Length; i++)
                            {
                                string ln = lines[i];
                                int colon = ln.IndexOf(':');
                                if (colon <= 0) continue;
                                string hName = ln.Substring(0, colon).Trim();
                                string hVal = ln.Substring(colon + 1).Trim();
                                if (hName.Equals("Connection", StringComparison.OrdinalIgnoreCase))
                                {
                                    if (hVal.IndexOf("close", StringComparison.OrdinalIgnoreCase) >= 0) closeConn = true;
                                    else if (hVal.IndexOf("keep-alive", StringComparison.OrdinalIgnoreCase) >= 0) closeConn = false;
                                }
                                else if (hName.Equals("If-None-Match", StringComparison.OrdinalIgnoreCase))
                                {
                                    ifNoneMatch = hVal;
                                }
                                else if (hName.Equals("Content-Length", StringComparison.OrdinalIgnoreCase))
                                {
                                    int parsedLen;
                                    if (int.TryParse(hVal, out parsedLen) && parsedLen > 0) contentLength = parsedLen;
                                }
                            }

                            if (contentLength > 0)
                            {
                                if (contentLength > 65536 || method == "POST") closeConn = true;
                                if (!closeConn)
                                {
                                    int toDrain = contentLength - bufLen;
                                    if (bufLen >= contentLength)
                                    {
                                        int left = bufLen - contentLength;
                                        if (left > 0) Buffer.BlockCopy(buf, contentLength, buf, 0, left);
                                        bufLen = left;
                                    }
                                    else
                                    {
                                        bufLen = 0;
                                        while (toDrain > 0)
                                        {
                                            int n = stream.Read(readBuf, 0, Math.Min(readBuf.Length, toDrain));
                                            if (n <= 0) return;
                                            toDrain -= n;
                                        }
                                    }
                                }
                            }

                            TouchActivity();

                            int qIdx = rawTarget.IndexOf('?');
                            string pathPart = qIdx >= 0 ? rawTarget.Substring(0, qIdx) : rawTarget;
                            string decoded;
                            try
                            {
                                decoded = Uri.UnescapeDataString(pathPart);
                            }
                            catch
                            {
                                WriteSimple(stream, 400, "Bad Request", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Bad Request"), true);
                                return;
                            }

                            string rel = NormalizePath(decoded);
                            if (rel.IndexOf("..", StringComparison.Ordinal) >= 0)
                            {
                                WriteSimple(stream, 403, "Forbidden", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Forbidden"), closeConn);
                                if (closeConn) return;
                                continue;
                            }

                            if (rel.Equals("__nucraft_health", StringComparison.OrdinalIgnoreCase))
                            {
                                string json = "{\"ok\":true,\"standalone\":true,\"build\":\"" + BuildId + "\",\"hash\":\"" + _bundleHash + "\",\"files\":" + _assets.Count.ToString() + "}";
                                byte[] jsonBytes = Encoding.UTF8.GetBytes(json);
                                WriteResponse(stream, 200, "OK", "application/json; charset=utf-8", null, "no-store", jsonBytes, method == "HEAD", closeConn);
                                if (closeConn) return;
                                continue;
                            }

                            if (rel.Equals("__nucraft_ping", StringComparison.OrdinalIgnoreCase))
                            {
                                WriteResponse(stream, 204, "No Content", null, null, "no-store", new byte[0], true, closeConn);
                                if (closeConn) return;
                                continue;
                            }

                            if (rel.Equals("__nucraft_bye", StringComparison.OrdinalIgnoreCase))
                            {
                                _byeReceived = true;
                                Interlocked.Exchange(ref _lastByeTicks, DateTime.UtcNow.Ticks);
                                WriteResponse(stream, 204, "No Content", null, null, "no-store", new byte[0], true, true);
                                return;
                            }

                            if (rel.Equals("__nucraft_shutdown", StringComparison.OrdinalIgnoreCase))
                            {
                                _shutdownRequested = true;
                                byte[] okBytes = Encoding.UTF8.GetBytes("{\"ok\":true}");
                                WriteResponse(stream, 200, "OK", "application/json; charset=utf-8", null, "no-store", okBytes, method == "HEAD", true);
                                Stop();
                                return;
                            }

                            if (method != "GET" && method != "HEAD")
                            {
                                WriteSimple(stream, 405, "Method Not Allowed", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Method Not Allowed"), true);
                                return;
                            }

                            if (string.IsNullOrEmpty(rel))
                            {
                                rel = _assets.ContainsKey("NUCRAFT.html") ? "NUCRAFT.html" : "index.html";
                            }

                            byte[] data;
                            if (!_assets.TryGetValue(rel, out data))
                            {
                                WriteSimple(stream, 404, "Not Found", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Not found"), closeConn);
                                if (closeConn) return;
                                continue;
                            }

                            string etag = "W/\"" + _bundleHash + "-" + data.Length.ToString() + "\"";
                            string cacheHdr = IsImmutableAsset(rel) ? "public, max-age=604800, immutable" : "no-cache";
                            if (!string.IsNullOrEmpty(ifNoneMatch) && ifNoneMatch.IndexOf(etag, StringComparison.Ordinal) >= 0)
                            {
                                WriteResponse(stream, 304, "Not Modified", null, etag, cacheHdr, new byte[0], true, closeConn);
                            }
                            else
                            {
                                WriteResponse(stream, 200, "OK", GetMimeType(rel), etag, cacheHdr, data, method == "HEAD", closeConn);
                            }

                            if (closeConn) return;
                        }
                    }
                }
                catch
                {
                }
                finally
                {
                    try { client.Close(); } catch { }
                }
            }

            private static int FindHeaderEnd(byte[] buf, int len)
            {
                for (int i = 0; i <= len - 4; i++)
                {
                    if (buf[i] == 13 && buf[i + 1] == 10 && buf[i + 2] == 13 && buf[i + 3] == 10)
                    {
                        return i;
                    }
                }
                return -1;
            }

            private static void WriteSimple(NetworkStream stream, int code, string reason, string contentType, byte[] body, bool closeConn)
            {
                WriteResponse(stream, code, reason, contentType, null, "no-store", body, false, closeConn);
            }

            private static void WriteResponse(NetworkStream stream, int code, string reason, string contentType, string etag, string cacheControl, byte[] body, bool headOnly, bool closeConn)
            {
                StringBuilder sb = new StringBuilder(256);
                sb.Append("HTTP/1.1 ").Append(code).Append(' ').Append(reason).Append("\r\n");
                if (!string.IsNullOrEmpty(contentType)) sb.Append("Content-Type: ").Append(contentType).Append("\r\n");
                if (code != 204 && code != 304) sb.Append("Content-Length: ").Append(body.Length).Append("\r\n");
                if (!string.IsNullOrEmpty(etag)) sb.Append("ETag: ").Append(etag).Append("\r\n");
                if (!string.IsNullOrEmpty(cacheControl)) sb.Append("Cache-Control: ").Append(cacheControl).Append("\r\n");
                sb.Append("X-Content-Type-Options: nosniff\r\n");
                sb.Append("Connection: ").Append(closeConn ? "close" : "keep-alive").Append("\r\n\r\n");

                byte[] hdrBytes = Encoding.ASCII.GetBytes(sb.ToString());
                stream.Write(hdrBytes, 0, hdrBytes.Length);
                if (!headOnly && body.Length > 0 && code != 204 && code != 304)
                {
                    stream.Write(body, 0, body.Length);
                }
                stream.Flush();
            }

            public void Stop()
            {
                _running = false;
                try { _listener.Stop(); } catch { }
            }

            public void Dispose()
            {
                Stop();
            }
        }

        private static bool IsPortOpen(string host, int port)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult ar = client.BeginConnect(host, port, null, null);
                    bool ok = ar.AsyncWaitHandle.WaitOne(80);
                    if (ok && client.Connected)
                    {
                        client.EndConnect(ar);
                        return true;
                    }
                }
            }
            catch { }
            return false;
        }

        private static string HttpProbe(int port, string reqPath, int timeoutMs, out int statusCode, out Dictionary<string, string> respHeaders)
        {
            statusCode = 0;
            respHeaders = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    client.ReceiveTimeout = timeoutMs;
                    client.SendTimeout = timeoutMs;
                    IAsyncResult ar = client.BeginConnect(IPAddress.Loopback, port, null, null);
                    if (!ar.AsyncWaitHandle.WaitOne(timeoutMs) || !client.Connected) return null;
                    client.EndConnect(ar);
                    using (NetworkStream stream = client.GetStream())
                    {
                        string req = "GET " + reqPath + " HTTP/1.1\r\nHost: 127.0.0.1:" + port.ToString() + "\r\nConnection: close\r\n\r\n";
                        byte[] reqBytes = Encoding.ASCII.GetBytes(req);
                        stream.Write(reqBytes, 0, reqBytes.Length);
                        stream.Flush();

                        using (MemoryStream ms = new MemoryStream())
                        {
                            byte[] tmp = new byte[4096];
                            int n;
                            while ((n = stream.Read(tmp, 0, tmp.Length)) > 0)
                            {
                                ms.Write(tmp, 0, n);
                                if (ms.Length > 262144) break;
                            }
                            byte[] raw = ms.ToArray();
                            string allText = Encoding.UTF8.GetString(raw);
                            int sep = allText.IndexOf("\r\n\r\n", StringComparison.Ordinal);
                            if (sep < 0) return null;
                            string head = allText.Substring(0, sep);
                            string[] lines = head.Split(new[] { "\r\n" }, StringSplitOptions.None);
                            if (lines.Length > 0)
                            {
                                string[] statusParts = lines[0].Split(' ');
                                if (statusParts.Length >= 2) int.TryParse(statusParts[1], out statusCode);
                            }
                            for (int i = 1; i < lines.Length; i++)
                            {
                                int c = lines[i].IndexOf(':');
                                if (c > 0) respHeaders[lines[i].Substring(0, c).Trim()] = lines[i].Substring(c + 1).Trim();
                            }
                            return allText.Substring(sep + 4);
                        }
                    }
                }
            }
            catch
            {
                return null;
            }
        }

        private static string HttpProbe(int port, string reqPath, int timeoutMs)
        {
            int status;
            Dictionary<string, string> headers;
            string body = HttpProbe(port, reqPath, timeoutMs, out status, out headers);
            return (status >= 200 && status < 300) ? body : null;
        }

        private static bool ProbeWithEtag(int port, string reqPath, string etag, out int statusCode)
        {
            statusCode = 0;
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    client.ReceiveTimeout = 1000;
                    client.SendTimeout = 1000;
                    client.Connect(IPAddress.Loopback, port);
                    using (NetworkStream stream = client.GetStream())
                    {
                        string req = "GET " + reqPath + " HTTP/1.1\r\nHost: 127.0.0.1:" + port.ToString() + "\r\nIf-None-Match: " + etag + "\r\nConnection: close\r\n\r\n";
                        byte[] reqBytes = Encoding.ASCII.GetBytes(req);
                        stream.Write(reqBytes, 0, reqBytes.Length);
                        stream.Flush();
                        byte[] tmp = new byte[1024];
                        int n = stream.Read(tmp, 0, tmp.Length);
                        if (n <= 0) return false;
                        string head = Encoding.ASCII.GetString(tmp, 0, n);
                        int eol = head.IndexOf("\r\n", StringComparison.Ordinal);
                        string line0 = eol >= 0 ? head.Substring(0, eol) : head;
                        string[] parts = line0.Split(' ');
                        if (parts.Length >= 2) int.TryParse(parts[1], out statusCode);
                        return true;
                    }
                }
            }
            catch
            {
                return false;
            }
        }

        private static string FindAppBrowser()
        {
            string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string lad = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string[] candidates = new[]
            {
                Path.Combine(pf86, @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(pf,   @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(pf,   @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(pf86, @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(lad,  @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(pf,   @"BraveSoftware\Brave-Browser\Application\brave.exe"),
                Path.Combine(pf86, @"BraveSoftware\Brave-Browser\Application\brave.exe"),
                Path.Combine(lad,  @"BraveSoftware\Brave-Browser\Application\brave.exe")
            };
            for (int i = 0; i < candidates.Length; i++)
            {
                string p = candidates[i];
                if (!string.IsNullOrEmpty(p) && File.Exists(p)) return p;
            }
            return null;
        }

        private static string BuildBrowserArgs(string targetUrl, string profileDir)
        {
            return "--app=\"" + targetUrl + "\" --user-data-dir=\"" + profileDir + "\" --window-size=1366,800 --start-maximized"
                + " --disk-cache-size=268435456"
                + " --no-first-run --no-default-browser-check --disable-extensions --disable-sync --disable-component-update --disable-translate --metrics-recording-only"
                + " --disable-background-mode"
                + " --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --enable-accelerated-2d-canvas"
                + " --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding"
                + " --disable-gpu-watchdog --disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling";
        }

        private static string ResolvePersistentProfileDir()
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string profileDir = Path.Combine(localAppData, "NUCRAFT", "AppProfile");
            string legacyDir = Path.Combine(Path.GetTempPath(), "NUCRAFT_AppProfile");
            try
            {
                if (!Directory.Exists(profileDir) && Directory.Exists(legacyDir))
                {
                    CopyDirectoryBestEffort(legacyDir, profileDir);
                }
                Directory.CreateDirectory(profileDir);
            }
            catch { }
            return profileDir;
        }

        private static void CopyDirectoryBestEffort(string srcDir, string dstDir)
        {
            try { Directory.CreateDirectory(dstDir); } catch { return; }
            try
            {
                string[] files = Directory.GetFiles(srcDir);
                for (int i = 0; i < files.Length; i++)
                {
                    try
                    {
                        string name = Path.GetFileName(files[i]);
                        File.Copy(files[i], Path.Combine(dstDir, name), false);
                    }
                    catch { }
                }
                string[] dirs = Directory.GetDirectories(srcDir);
                for (int i = 0; i < dirs.Length; i++)
                {
                    string name = Path.GetFileName(dirs[i]);
                    CopyDirectoryBestEffort(dirs[i], Path.Combine(dstDir, name));
                }
            }
            catch { }
        }

        private static string RunSelfTest(Dictionary<string, byte[]> assets, string bundleHash, string browser, string profileDir)
        {
            if (assets.Count < 100
                || !assets.ContainsKey("NUCRAFT.html")
                || !assets.ContainsKey("assets/nucraft_app.min.js")
                || !assets.ContainsKey("src/world/chunkWorker.js"))
            {
                return "FAIL|incomplete_bundle|files=" + assets.Count.ToString();
            }

            string firstGlb = null;
            string firstOgg = null;
            foreach (string key in assets.Keys)
            {
                if (firstGlb == null && key.EndsWith(".glb", StringComparison.OrdinalIgnoreCase)) firstGlb = key;
                if (firstOgg == null && key.EndsWith(".ogg", StringComparison.OrdinalIgnoreCase)) firstOgg = key;
                if (firstGlb != null && firstOgg != null) break;
            }
            if (firstGlb == null || firstOgg == null)
            {
                return "FAIL|missing_binary_assets|glb=" + (firstGlb ?? "none") + "|ogg=" + (firstOgg ?? "none");
            }

            string sampleArgs = BuildBrowserArgs("http://127.0.0.1:4173/?exe=1&standalone=1&v=124", profileDir);
            bool hasBadCacheFlag = sampleArgs.IndexOf("--disk-cache-size=1 ", StringComparison.Ordinal) >= 0
                || sampleArgs.EndsWith("--disk-cache-size=1", StringComparison.Ordinal)
                || sampleArgs.IndexOf("--disable-application-cache", StringComparison.Ordinal) >= 0;

            using (EmbeddedHttpServer srv = new EmbeddedHttpServer(assets, bundleHash, 0))
            {
                int p = srv.Port;
                int code;
                Dictionary<string, string> hdrs;

                string hBody = HttpProbe(p, "/__nucraft_health", 1000, out code, out hdrs);
                if (code != 200 || hBody == null || hBody.IndexOf("\"standalone\":true", StringComparison.Ordinal) < 0)
                    return "FAIL|health_check|code=" + code.ToString();

                string htmlBody = HttpProbe(p, "/", 1000, out code, out hdrs);
                string ctHtml;
                hdrs.TryGetValue("Content-Type", out ctHtml);
                if (code != 200 || htmlBody == null || htmlBody.IndexOf("NUCRAFT", StringComparison.Ordinal) < 0 || (ctHtml ?? "").IndexOf("text/html", StringComparison.OrdinalIgnoreCase) < 0)
                    return "FAIL|root_html|code=" + code.ToString();

                HttpProbe(p, "/assets/nucraft_app.min.js", 1000, out code, out hdrs);
                string ctJs;
                hdrs.TryGetValue("Content-Type", out ctJs);
                if (code != 200 || (ctJs ?? "").IndexOf("javascript", StringComparison.OrdinalIgnoreCase) < 0)
                    return "FAIL|app_min_js|code=" + code.ToString();

                HttpProbe(p, "/src/world/chunkWorker.js", 1000, out code, out hdrs);
                if (code != 200) return "FAIL|chunk_worker|code=" + code.ToString();

                HttpProbe(p, "/favicon.ico", 1000, out code, out hdrs);
                if (code != 200) return "FAIL|favicon|code=" + code.ToString();

                HttpProbe(p, "/" + firstGlb, 1000, out code, out hdrs);
                string glbEtag;
                hdrs.TryGetValue("ETag", out glbEtag);
                if (code != 200 || string.IsNullOrEmpty(glbEtag)) return "FAIL|glb_fetch|code=" + code.ToString();

                int code304;
                if (!ProbeWithEtag(p, "/" + firstGlb, glbEtag, out code304) || code304 != 304)
                    return "FAIL|glb_etag_304|code=" + code304.ToString();

                HttpProbe(p, "/" + firstOgg, 1000, out code, out hdrs);
                string ctOgg;
                hdrs.TryGetValue("Content-Type", out ctOgg);
                if (code != 200 || (ctOgg ?? "").IndexOf("audio/ogg", StringComparison.OrdinalIgnoreCase) < 0)
                    return "FAIL|ogg_fetch|code=" + code.ToString();
            }

            if (hasBadCacheFlag) return "FAIL|bad_cache_flag";

            return "OK|" + BuildId
                + "|standalone=True"
                + "|files=" + assets.Count.ToString()
                + "|hash=" + bundleHash
                + "|browser=" + (browser ?? "none")
                + "|httpChecks=PASS"
                + "|hasBadCacheFlag=False";
        }

        private static EmbeddedHttpServer TryStartEmbedded(Dictionary<string, byte[]> assets, string bundleHash, int port)
        {
            try
            {
                return new EmbeddedHttpServer(assets, bundleHash, port);
            }
            catch
            {
                return null;
            }
        }

        [STAThread]
        private static void Main(string[] cmdArgs)
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            bool selfTest = false;
            string selfTestOut = null;
            if (cmdArgs != null)
            {
                for (int i = 0; i < cmdArgs.Length; i++)
                {
                    string a = cmdArgs[i] ?? "";
                    if (a == "--self-test") selfTest = true;
                    else if (a.StartsWith("--self-test=", StringComparison.OrdinalIgnoreCase))
                    {
                        selfTest = true;
                        selfTestOut = a.Substring(12).Trim('"');
                    }
                }
            }

            Dictionary<string, byte[]> assets;
            string bundleHash;
            if (!LoadEmbeddedBundle(out assets, out bundleHash))
            {
                string err = "FAIL|missing_embedded_bundle";
                if (selfTest)
                {
                    if (!string.IsNullOrEmpty(selfTestOut)) File.WriteAllText(selfTestOut, err);
                    Console.WriteLine(err);
                    Environment.ExitCode = 1;
                    return;
                }
                MessageBox.Show("Du lieu game ben trong file NUCRAFT.exe bi thieu hoac hong.", "NUCRAFT", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            string browser = FindAppBrowser();
            string profileDir = ResolvePersistentProfileDir();

            if (selfTest)
            {
                string report = RunSelfTest(assets, bundleHash, browser, profileDir);
                if (!string.IsNullOrEmpty(selfTestOut)) File.WriteAllText(selfTestOut, report);
                Console.WriteLine(report);
                Environment.ExitCode = report.StartsWith("OK|", StringComparison.Ordinal) ? 0 : 1;
                return;
            }

            EmbeddedHttpServer ownedServer = null;
            bool reusingExisting = false;
            bool usingEmbedded = true;
            int actualPort = PreferredPort;

            if (!IsPortOpen("127.0.0.1", PreferredPort))
            {
                ownedServer = TryStartEmbedded(assets, bundleHash, PreferredPort);
                if (ownedServer != null) actualPort = ownedServer.Port;
            }
            else
            {
                string health = HttpProbe(PreferredPort, "/__nucraft_health", 250);
                if (health != null && health.IndexOf("\"standalone\":true", StringComparison.Ordinal) >= 0)
                {
                    if (health.IndexOf("\"hash\":\"" + bundleHash + "\"", StringComparison.Ordinal) >= 0)
                    {
                        reusingExisting = true;
                        usingEmbedded = true;
                        actualPort = PreferredPort;
                    }
                    else
                    {
                        HttpProbe(PreferredPort, "/__nucraft_shutdown", 300);
                        for (int i = 0; i < 20; i++)
                        {
                            Thread.Sleep(50);
                            if (!IsPortOpen("127.0.0.1", PreferredPort)) break;
                        }
                        ownedServer = TryStartEmbedded(assets, bundleHash, PreferredPort);
                        if (ownedServer != null) actualPort = ownedServer.Port;
                    }
                }
                else if (File.Exists(Path.Combine(baseDir, "server.js")))
                {
                    string rooms = HttpProbe(PreferredPort, "/api/rooms", 200);
                    if (rooms != null && rooms.IndexOf("\"ok\":true", StringComparison.Ordinal) >= 0)
                    {
                        reusingExisting = true;
                        usingEmbedded = false;
                        actualPort = PreferredPort;
                    }
                }
            }

            if (!reusingExisting && ownedServer == null)
            {
                for (int p = PreferredPort + 1; p <= PreferredPort + 26; p++)
                {
                    ownedServer = TryStartEmbedded(assets, bundleHash, p);
                    if (ownedServer != null) { actualPort = ownedServer.Port; break; }
                }
                if (ownedServer == null)
                {
                    ownedServer = TryStartEmbedded(assets, bundleHash, 0);
                    if (ownedServer != null) actualPort = ownedServer.Port;
                }
            }

            if (!reusingExisting && ownedServer == null)
            {
                MessageBox.Show("Khong the khoi dong may chu noi bo cho NUCRAFT.", "NUCRAFT", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            string targetUrl = "http://127.0.0.1:" + actualPort.ToString() + "/?exe=1"
                + (usingEmbedded ? "&standalone=1" : "")
                + "&v=124&h=" + bundleHash;
            string args = BuildBrowserArgs(targetUrl, profileDir);

            Process browserProc = null;
            DateTime launchUtc = DateTime.UtcNow;
            try
            {
                if (browser != null)
                {
                    browserProc = Process.Start(new ProcessStartInfo(browser, args) { UseShellExecute = false });
                }
                else
                {
                    browserProc = Process.Start(new ProcessStartInfo(targetUrl) { UseShellExecute = true });
                }
            }
            catch (Exception ex)
            {
                if (ownedServer != null) ownedServer.Dispose();
                MessageBox.Show("Khong the mo cua so game NUCRAFT:\n" + ex.Message, "NUCRAFT", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            if (ownedServer != null)
            {
                try
                {
                    bool detachedHandoff = (browserProc == null);
                    if (browserProc != null)
                    {
                        while (!browserProc.HasExited && !ownedServer.ShutdownRequested)
                        {
                            Thread.Sleep(200);
                        }
                        double livedMs = (DateTime.UtcNow - launchUtc).TotalMilliseconds;
                        if (livedMs >= 4000.0 || ownedServer.ShutdownRequested)
                        {
                            Thread.Sleep(250);
                            return;
                        }
                        detachedHandoff = true;
                    }

                    if (detachedHandoff)
                    {
                        while (!ownedServer.ShutdownRequested)
                        {
                            Thread.Sleep(250);
                            DateTime nowUtc = DateTime.UtcNow;
                            if ((nowUtc - launchUtc).TotalSeconds < 12.0) continue;
                            if (ownedServer.ByeReceived && (nowUtc - ownedServer.LastByeUtc).TotalSeconds >= 2.0) break;
                            if ((nowUtc - ownedServer.LastActivityUtc).TotalSeconds >= 25.0) break;
                        }
                    }
                }
                finally
                {
                    ownedServer.Dispose();
                }
            }
        }
    }
}
