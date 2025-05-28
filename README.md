# 🎵 clip-tagger

> Custom audio tagging in the browser using CLAP (Contrastive Language-Audio Pre-training)

Instantly tag any audio with AI that learns from your corrections. Upload files or record directly in your browser - everything runs locally, no servers needed.

## ✨ Features

- **🎤 Audio Input**: Upload files or record directly from your microphone
- **🧠 Smart Tagging**: CLAP model identifies speech, music, ambient sounds, and more
- **📚 Personalized Learning**: Correct tags and add custom ones - the model adapts to your domain
- **💾 Persistent Memory**: Your corrections are saved and improve future predictions
- **📁 Export Ready**: Export tagged data and trained models for sharing
- **🔒 Privacy First**: Everything runs in your browser - no data leaves your device

## 🚀 How It Works

1. **Drop an audio file** or click record
2. **Review AI-generated tags** with confidence scores
3. **Correct tags** with ✓/✗ buttons or add custom tags
4. **Watch the model learn** from your feedback in real-time
5. **Export results** or share your trained model

## 🔧 Technical Details

- **Model**: [Xenova/clap-htsat-unfused](https://huggingface.co/Xenova/clap-htsat-unfused) (~45MB)
- **Framework**: [Transformers.js](https://github.com/xenova/transformers.js) + React
- **Storage**: IndexedDB for user feedback and model weights
- **Deployment**: Ready for Hugging Face Spaces

## 🎯 Use Cases

- Voice memo organization
- Music library tagging
- Audio content moderation
- Podcast categorization
- Sound effect libraries
- Research datasets

---

*Powered by Transformers.js • Runs entirely in your browser*
