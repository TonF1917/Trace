using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using System.Drawing;
using Microsoft.Win32;

namespace TraceLauncher {
    static class Program {
        const int VITE_PORT = 5173;
        // Vite 8 requires Node >= 20.19 (or >= 22.12); require 20.19+ so "too old" installs get replaced
        // by a portable runtime rather than failing inside Vite.
        const string NODE_MIN_VERSION = "20.19";

        static Form controlForm;
        static Label statusLabel;

        [STAThread]
        static void Main() {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string appDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app");
            if (!Directory.Exists(appDir)) {
                MessageBox.Show("The 'app' folder was not found next to Trace.exe.\nKeep Trace.exe in the repository root directory.",
                    "Trace", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            CreateControlWindow();

            // ---- 1. Resolve (or auto-install) Node.js ----
            SetStatus("Detecting Node.js...");
            string nodeDir = EnsureNodeJs();
            if (nodeDir == null) {
                MessageBox.Show(
                    "Could not automatically install Node.js.\n\n" +
                    "Please install the Node.js LTS from https://nodejs.org and start Trace again.",
                    "Trace", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            // ---- 2. Install dependencies when missing (retry via npmmirror for CN networks) ----
            if (!Directory.Exists(Path.Combine(appDir, "node_modules")) ||
                !Directory.Exists(Path.Combine(appDir, "node_modules", "express"))) {
                SetStatus("Installing dependencies (first run, a few minutes)...");
                if (!RunNpmInstall(appDir, nodeDir)) {
                    MessageBox.Show("npm install failed (network or registry issue).\nCheck your internet connection and start Trace again.",
                        "Trace", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }
            }

            // ---- 3. Start the Vite server unless the port is already being served ----
            Process serverProcess = null;
            if (IsServerUp()) {
                SetStatus("Trace server already running on port " + VITE_PORT + ".");
            } else {
                SetStatus("Starting Trace server...");
                serverProcess = StartServer(appDir, nodeDir);

                SetStatus("Waiting for the server to come up...");
                bool up = false;
                for (int i = 0; i < 180; i++) { // up to ~90 seconds
                    if (IsServerUp()) { up = true; break; }
                    if (serverProcess.HasExited) break;
                    Thread.Sleep(500);
                }
                if (!up && serverProcess.HasExited) {
                    MessageBox.Show("Trace server failed to start.\nStart Trace again, or run 'npm run dev' inside the 'app' folder to see the error.",
                        "Trace", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }
            }

            // ---- 4. Open the browser only after the server answers ----
            try { Process.Start("http://localhost:" + VITE_PORT); } catch { }

            SetStatus("Trace is running.\nClose this window to stop the server.");

            // Scoped cleanup: on close, kill ONLY the server tree we spawned.
            controlForm.FormClosed += (sender, e) => {
                if (serverProcess != null && !serverProcess.HasExited) KillTree(serverProcess.Id);
            };

            Application.Run(controlForm);
        }

        // ================= Node.js resolution & install =================

        static string EnsureNodeJs() {
            string dir = FindSystemNode();
            if (dir != null) return dir;

            SetStatus("Node.js not found - installing via winget (a few minutes)...");
            if (TryWingetInstall()) {
                dir = FindSystemNode(); // re-scan PATH freshly read from the registry
                if (dir != null) return dir;
            }

            SetStatus("Downloading portable Node.js runtime...");
            return TryPortableInstall();
        }

        static string FindSystemNode() {
            string nodePath = WhereNode();
            if (nodePath == null) return null;
            string ver = GetNodeVersion(nodePath);
            if (ver == null || CompareVersion(ver, NODE_MIN_VERSION) < 0) return null;
            return Path.GetDirectoryName(nodePath);
        }

        static string WhereNode() {
            string outp = RunCapture("where node");
            if (string.IsNullOrWhiteSpace(outp)) return null;
            foreach (string line in outp.Split('\n')) {
                string p = line.Trim();
                if (p.EndsWith("node.exe", StringComparison.OrdinalIgnoreCase) && File.Exists(p)) return p;
            }
            return null;
        }

        static string GetNodeVersion(string nodeExe) {
            string outp = RunCapture("\"" + nodeExe + "\" --version"); // e.g. v22.14.0
            Match m = Regex.Match(outp ?? "", @"v(\d+(?:\.\d+)+)");
            return m.Success ? m.Groups[1].Value : null;
        }

        static int CompareVersion(string a, string b) {
            string[] pa = a.Split('.'), pb = b.Split('.');
            for (int i = 0; i < Math.Max(pa.Length, pb.Length); i++) {
                int va, vb;
                int.TryParse(i < pa.Length ? pa[i] : "0", out va);
                int.TryParse(i < pb.Length ? pb[i] : "0", out vb);
                if (va != vb) return va.CompareTo(vb);
            }
            return 0;
        }

        static bool TryWingetInstall() {
            if (string.IsNullOrWhiteSpace(RunCapture("where winget"))) return false;
            try {
                var psi = new ProcessStartInfo("cmd.exe",
                    "/c winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements") {
                    UseShellExecute = false, CreateNoWindow = true
                };
                using (var p = Process.Start(psi)) {
                    p.WaitForExit();
                    return p.ExitCode == 0;
                }
            } catch { return false; }
        }

        static string TryPortableInstall() {
            try {
                string baseDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Trace", "runtime");
                Directory.CreateDirectory(baseDir);

                string fileName = null;
                foreach (string listingUrl in new[] {
                    "https://nodejs.org/dist/latest-v22.x/",
                    "https://npmmirror.com/mirrors/node/latest-v22.x/" }) {
                    string listing = HttpGet(listingUrl, 30000);
                    Match m = listing == null ? null : Regex.Match(listing, @"node-v[\d\.]+-win-x64\.zip");
                    if (m.Success) { fileName = m.Value; break; }
                }
                if (fileName == null) return null;

                string extractDir = Path.Combine(baseDir, Path.GetFileNameWithoutExtension(fileName));
                string nodeDir = Path.Combine(extractDir, Path.GetFileNameWithoutExtension(fileName));
                if (File.Exists(Path.Combine(nodeDir, "node.exe"))) return nodeDir;
                if (File.Exists(Path.Combine(extractDir, "node.exe"))) return extractDir;

                string zipPath = Path.Combine(Path.GetTempPath(), fileName);
                bool downloaded =
                    HttpDownload("https://nodejs.org/dist/latest-v22.x/" + fileName, zipPath, 600000) ||
                    HttpDownload("https://npmmirror.com/mirrors/node/latest-v22.x/" + fileName, zipPath, 600000);
                if (!downloaded) return null;

                SetStatus("Extracting Node.js...");
                ZipFile.ExtractToDirectory(zipPath, extractDir);

                if (File.Exists(Path.Combine(nodeDir, "node.exe"))) return nodeDir;
                if (File.Exists(Path.Combine(extractDir, "node.exe"))) return extractDir;
                return null;
            } catch { return null; }
        }

        // ================= npm / server helpers =================

        static bool RunNpmInstall(string appDir, string nodeDir) {
            if (RunNpm(appDir, nodeDir, "npm install")) return true;
            SetStatus("Retrying dependencies via npmmirror...");
            return RunNpm(appDir, nodeDir, "npm install --registry=https://registry.npmmirror.com");
        }

        static bool RunNpm(string appDir, string nodeDir, string args) {
            try {
                var psi = new ProcessStartInfo("cmd.exe", "/c " + args) {
                    UseShellExecute = false,
                    WorkingDirectory = appDir,
                    CreateNoWindow = true
                };
                psi.EnvironmentVariables["PATH"] = nodeDir + ";" + FreshSystemPath();
                using (var p = Process.Start(psi)) {
                    p.WaitForExit(20 * 60 * 1000);
                    return p.HasExited && p.ExitCode == 0;
                }
            } catch { return false; }
        }

        static Process StartServer(string appDir, string nodeDir) {
            var psi = new ProcessStartInfo("cmd.exe", "/c npm run dev") {
                UseShellExecute = false,
                WorkingDirectory = appDir,
                CreateNoWindow = true
            };
            psi.EnvironmentVariables["PATH"] = nodeDir + ";" + FreshSystemPath();
            return Process.Start(psi);
        }

        static bool IsServerUp() {
            foreach (string host in new[] { "http://localhost:" + VITE_PORT, "http://127.0.0.1:" + VITE_PORT }) {
                try {
                    var req = (HttpWebRequest)WebRequest.Create(host);
                    req.Timeout = 1500;
                    req.ReadWriteTimeout = 1500;
                    using (var resp = (HttpWebResponse)req.GetResponse()) {
                        if ((int)resp.StatusCode < 500) return true;
                    }
                } catch (WebException wex) {
                    if (wex.Response != null) return true; // any HTTP answer means the port is served
                } catch { }
            }
            return false;
        }

        // Scoped cleanup: kill ONLY the process tree of the server we spawned.
        // Never touch other node.exe processes on the machine.
        static void KillTree(int pid) {
            try {
                var psi = new ProcessStartInfo("cmd.exe", "/c taskkill /PID " + pid + " /T /F") {
                    UseShellExecute = false, CreateNoWindow = true
                };
                using (var p = Process.Start(psi)) p.WaitForExit(15000);
            } catch { }
        }

        // ================= misc helpers =================

        static string FreshSystemPath() {
            try {
                string machine = (Registry.LocalMachine.OpenSubKey(
                    @"SYSTEM\CurrentControlSet\Control\Session Manager\Environment") ??
                    Registry.LocalMachine).GetValue("Path", "") as string ?? "";
                string user = (Registry.CurrentUser.OpenSubKey("Environment") ??
                    Registry.CurrentUser).GetValue("Path", "") as string ?? "";
                return machine + ";" + user;
            } catch { return Environment.GetEnvironmentVariable("PATH") ?? ""; }
        }

        static string RunCapture(string args) {
            try {
                var psi = new ProcessStartInfo("cmd.exe", "/c " + args) {
                    UseShellExecute = false, RedirectStandardOutput = true, CreateNoWindow = true
                };
                using (var p = Process.Start(psi)) {
                    string o = p.StandardOutput.ReadToEnd();
                    p.WaitForExit(15000);
                    return o;
                }
            } catch { return null; }
        }

        static string HttpGet(string url, int timeoutMs) {
            try {
                var req = (HttpWebRequest)WebRequest.Create(url);
                req.Timeout = timeoutMs;
                req.ReadWriteTimeout = timeoutMs;
                using (var resp = req.GetResponse())
                using (var sr = new StreamReader(resp.GetResponseStream()))
                    return sr.ReadToEnd();
            } catch { return null; }
        }

        static bool HttpDownload(string url, string dest, int timeoutMs) {
            try {
                var req = (HttpWebRequest)WebRequest.Create(url);
                req.Timeout = timeoutMs;
                req.ReadWriteTimeout = timeoutMs;
                using (var resp = req.GetResponse())
                using (var input = resp.GetResponseStream())
                using (var output = File.Create(dest)) {
                    byte[] buf = new byte[81920];
                    int n;
                    while ((n = input.Read(buf, 0, buf.Length)) > 0) output.Write(buf, 0, n);
                }
                return File.Exists(dest) && new FileInfo(dest).Length > 0;
            } catch { return false; }
        }

        static void CreateControlWindow() {
            controlForm = new Form();
            controlForm.Text = "Trace Server";
            controlForm.Size = new Size(360, 170);
            controlForm.StartPosition = FormStartPosition.CenterScreen;
            controlForm.FormBorderStyle = FormBorderStyle.FixedDialog;
            controlForm.MaximizeBox = false;
            controlForm.WindowState = FormWindowState.Minimized;
            try { controlForm.Icon = new Icon(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Trace.ico")); } catch { }

            statusLabel = new Label();
            statusLabel.Text = "Starting Trace...";
            statusLabel.TextAlign = ContentAlignment.MiddleCenter;
            statusLabel.Dock = DockStyle.Fill;
            statusLabel.Font = new Font("Segoe UI", 10, FontStyle.Regular);
            controlForm.Controls.Add(statusLabel);

            controlForm.Show();
            Application.DoEvents();
        }

        static void SetStatus(string text) {
            if (statusLabel != null) {
                statusLabel.Text = text;
                Application.DoEvents();
            }
        }
    }
}
