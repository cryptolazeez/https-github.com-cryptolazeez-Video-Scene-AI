# CineScript AI 🎬✨

**Enterprise-grade AI suite for cinematic transcription, scene analysis, and multimodal prompt engineering.**

CineScript AI leverages advanced neural processing to unlock the narrative layers of film and audio. designed for creators, filmmakers, and prompt engineers, it converts media assets into structured intelligence with frame-accurate precision.

---

## 🚀 Deployment

### Deploy to Render
1. Create a new **Web Service** on [Render](https://render.com).
2. Connect your repository.
3. Use the following settings:
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. Add the following **Environment Variables**:
   - `GEMINI_API_KEY`: Your API key from [Google AI Studio](https://aistudio.google.com).
   - `NODE_ENV`: `production`

Alternatively, use the `render.yaml` file in this repository by selecting the "Blueprint" option on Render.

---

## ✨ Features

- **Multimodal Transcription:** Accurate dialogue extraction in over 100 languages.
- **Scene Vision Matrix:** Automated scene-by-scene deconstruction identifying lighting, composition, and atmosphere.
- **Cinematic Prompt Engineering:** 
  - **Detailed Image Prompts:** Optimized for DALL-E 3, Midjourney v6, and Stable Diffusion.
  - **Image-to-Video Prompts:** Tailored for SORA, Runway Gen-3, Luma Dream Machine, and Kling.
- **Vector Extraction:** High-fidelity WAV audio extraction directly from video sources.
- **Linguistic Localization:** Instant translation of scene contexts and summaries.
- **Studio Interface:** A minimalist, high-performance workspace designed for speed and clarity.

---

## 🛠 Tech Stack

- **Framework:** React 18 + Vite
- **AI Engine:** Google Gemini 1.5 Series (Multimodal Large Language Model)
- **Styling:** Tailwind CSS (Modern Glassmorphism Aesthetic)
- **Animations:** Motion (formerly Framer Motion)
- **Icons:** Lucide React
- **Typography:** Inter, Playfair Display (Serif), and JetBrains Mono

---

## 📖 Usage Instructions

1. **Launch Studio:** Enter the workbench from the landing page.
2. **Ingest Assets:** Drop a video or audio file (up to 50MB).
3. **Configure Pipeline:** Select your source dialect and target translation language.
4. **Initialize Processing:** Run the AI analysis to generate the results.
5. **Download/Copy:** Extract the lossless audio or copy the structured cinematic intelligence.

---

## 📋 Operational Thresholds

- **Maximum Signal Buffer:** 50 MB
- **Optimal Clip Duration:** < 90 Seconds
- **Supported Encodings:** MP4, MOV, MP3, WAV
- **AI Model:** Gemini 1.5 Flash (Optimized for low-latency multimodal reasoning)

---

## 🛡 License

CineScript AI is provided as an experimental creative tool. All rights reserved by CineScript Industries. 

---

*Built with ❤️ for the cinematic future by [imagineverse.studio](https://imagineverse.studio)*
