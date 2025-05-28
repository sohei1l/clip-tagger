import { pipeline } from '@xenova/transformers';

class CLAPProcessor {
  constructor() {
    this.pipeline = null;
    this.defaultLabels = [
      'speech', 'music', 'singing', 'guitar', 'piano', 'drums', 'violin',
      'trumpet', 'saxophone', 'flute', 'classical music', 'rock music',
      'pop music', 'jazz', 'electronic music', 'ambient', 'nature sounds',
      'rain', 'wind', 'ocean waves', 'birds chirping', 'dog barking',
      'cat meowing', 'car engine', 'traffic', 'footsteps', 'door closing',
      'applause', 'laughter', 'crying', 'coughing', 'sneezing',
      'telephone ringing', 'alarm clock', 'typing', 'water running',
      'fire crackling', 'thunder', 'helicopter', 'airplane', 'train',
      'motorcycle', 'bell ringing', 'whistle', 'horn', 'siren',
      'explosion', 'gunshot', 'silence', 'noise', 'distortion'
    ];
  }

  async initialize() {
    if (this.pipeline) return;

    try {
      console.log('Loading CLAP model...');
      // Use the pipeline API which is more stable
      this.pipeline = await pipeline('zero-shot-audio-classification', 'Xenova/clap-htsat-unfused');
      console.log('CLAP model loaded successfully');
    } catch (error) {
      console.error('Failed to load CLAP model:', error);
      throw error;
    }
  }

  async processAudio(audioBuffer) {
    if (!this.pipeline) {
      await this.initialize();
    }

    try {
      // Convert audio to the format expected by the model
      const audio = await this.preprocessAudio(audioBuffer);
      
      console.log('Processing audio with CLAP...');
      
      // Use the pipeline for zero-shot classification
      const results = await this.pipeline(audio, this.defaultLabels);
      
      console.log('CLAP results:', results);
      
      // Transform results to our format
      const tags = results.slice(0, 5).map(result => ({
        label: result.label,
        confidence: result.score
      }));
      
      return tags;
    } catch (error) {
      console.error('Error processing audio:', error);
      throw error;
    }
  }

  async preprocessAudio(audioBuffer) {
    // Convert to mono and get raw audio data
    let audioData;
    if (audioBuffer.numberOfChannels > 1) {
      // Convert stereo to mono by averaging channels
      const channel1 = audioBuffer.getChannelData(0);
      const channel2 = audioBuffer.getChannelData(1);
      audioData = new Float32Array(channel1.length);
      for (let i = 0; i < channel1.length; i++) {
        audioData[i] = (channel1[i] + channel2[i]) / 2;
      }
    } else {
      audioData = audioBuffer.getChannelData(0);
    }

    // Return the audio data with sample rate info
    return {
      data: audioData,
      sampling_rate: audioBuffer.sampleRate
    };
  }

  // Convert file to AudioBuffer
  async fileToAudioBuffer(file) {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return await audioContext.decodeAudioData(arrayBuffer);
  }
}

export default CLAPProcessor;