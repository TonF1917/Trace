using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using System.Drawing;

namespace TraceLauncher {
    static class Program {
        [STAThread]
        static void Main() {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string appDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app");
            
            // Check dependencies
            if (!Directory.Exists(Path.Combine(appDir, "node_modules"))) {
                var installProcess = new Process();
                installProcess.StartInfo.FileName = "cmd.exe";
                installProcess.StartInfo.Arguments = "/c npm install";
                installProcess.StartInfo.WorkingDirectory = appDir;
                installProcess.StartInfo.WindowStyle = ProcessWindowStyle.Minimized;
                installProcess.Start();
                installProcess.WaitForExit();
            }

            // Start Vite server hidden
            var serverProcess = new Process();
            serverProcess.StartInfo.FileName = "cmd.exe";
            serverProcess.StartInfo.Arguments = "/c npm run dev";
            serverProcess.StartInfo.WorkingDirectory = appDir;
            serverProcess.StartInfo.WindowStyle = ProcessWindowStyle.Hidden;
            serverProcess.StartInfo.CreateNoWindow = true;
            serverProcess.StartInfo.UseShellExecute = false;
            
            // Allow killing child processes (npm -> node -> vite) by attaching to job object?
            // Windows is notoriously bad at killing child processes.
            // A simple hack: just kill node.exe on exit.
            
            serverProcess.Start();
            
            // Open Browser
            Process.Start("http://localhost:5173");

            // Show a tiny control window instead of a console terminal
            Form controlForm = new Form();
            controlForm.Text = "Trace Server";
            controlForm.Size = new Size(300, 150);
            controlForm.StartPosition = FormStartPosition.CenterScreen;
            controlForm.FormBorderStyle = FormBorderStyle.FixedDialog;
            controlForm.MaximizeBox = false;
            controlForm.WindowState = FormWindowState.Minimized;
            try {
                controlForm.Icon = new Icon(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Trace.ico"));
            } catch { }
            
            Label lbl = new Label();
            lbl.Text = "Trace is running in the background.\nClose this window to stop the server.";
            lbl.TextAlign = ContentAlignment.MiddleCenter;
            lbl.Dock = DockStyle.Fill;
            lbl.Font = new Font("Segoe UI", 10, FontStyle.Regular);
            
            controlForm.Controls.Add(lbl);

            controlForm.FormClosed += (sender, e) => {
                try {
                    // Try to kill the server process
                    if (!serverProcess.HasExited) {
                        serverProcess.Kill();
                    }
                    // Force kill any orphaned node processes spawned by npm in this app directory
                    Process.Start(new ProcessStartInfo {
                        FileName = "cmd.exe",
                        Arguments = "/c taskkill /F /IM node.exe /T",
                        WindowStyle = ProcessWindowStyle.Hidden,
                        CreateNoWindow = true
                    }).WaitForExit();
                } catch { }
            };

            Application.Run(controlForm);
        }
    }
}
