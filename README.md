# 📡 StreamXpert 2.0 Studio

> **Ultra-Low Latency, High-Performance Multi-Platform RTMP Streaming Software**  
> Engineered for 24/7 continuous broadcasting on low-resource VPS / 4-Core 8GB RDP environments.

---

## ✨ Features

- ⚡ **Passthrough Stream Copy (-c:v copy)**: Uses < 0.5% CPU per stream, enabling 15–20+ simultaneous live streams on a 4-Core RDP.
- 📱 **TikTok Live Integration**: Dedicated RTMP streaming with automatic vertical format (9:16 portrait) support.
- 🌐 **Multi-Platform Broadcasting**: Simultaneous broadcast to TikTok Live, YouTube Live, Facebook Live, and Custom RTMP destinations using hardware-accelerated 	ee multiplexing.
- 🎨 **5 Luxury Studio Color Schemes**: Matrix Mint (Pro), Electric Azure, Cyber Violet, Solar Amber, and Stealth Titanium.
- 🚀 **Zero-Server Cloud Auto-Updater**: Instant silent background self-updating via GitHub Gist & GitHub Releases.
- 🔄 **Infinite Looping & Auto-Reconnect**: Resilient stream auto-recovery with jitter backoff.

---

## 🛠️ Tech Stack

- **Electron** (Chromium + Node.js)
- **FFmpeg** Engine with process tree supervisor & Windows priority scheduling
- **NSIS** Custom Silent Installer

---

## 📦 Building

`ash
# Install dependencies
npm install

# Run in development
npm start

# Build Windows NSIS Installer (Setup.exe)
npm run pack:exe
`

---

## 👤 Author
Developed by **Shahzaib Jutt**
