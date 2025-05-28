# clip-tagger

Custom audio tagging in the browser using CLAP (Contrastive Language-Audio Pre-training).

## Features

- Upload or record audio clips (voice, music, ambient sounds)
- Local CLAP model for automatic tag generation
- User-correctable tags with personalized learning
- Lightweight classifier that adapts to your domain
- Runs entirely in the browser with JavaScript/WASM

## Model

Uses the Xenova/clap-htsat-unfused ONNX model (~45MB) running locally via Transformers.js.

## Demo

Drop an audio file to get started with automatic tagging.
