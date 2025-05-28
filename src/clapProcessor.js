import { pipeline } from '@xenova/transformers';

class CLAPProcessor {
  constructor() {
    this.classifier = null;
    this.isInitialized = false;
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
    if (this.isInitialized) return;

    try {
      console.log('🔄 Loading CLAP model (this may take a moment)...');
      
      // Create a zero-shot audio classification pipeline
      this.classifier = await pipeline(
        'zero-shot-audio-classification',
        'Xenova/clap-htsat-unfused',
        {
          // Optional: specify device and other configs
          device: 'webgpu', // fallback to cpu if webgpu not available
        }
      );
      
      this.isInitialized = true;
      console.log('✅ CLAP model loaded successfully!');
    } catch (error) {
      console.error('❌ Failed to load CLAP model:', error);
      throw new Error(`Failed to initialize CLAP model: ${error.message}`);
    }
  }

  async processAudio(audioBuffer) {
    console.log('🎵 Starting audio processing...');
    
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Convert AudioBuffer to the format expected by the model
      const audioData = this.extractAudioData(audioBuffer);
      
      console.log('🔍 Classifying audio with', this.defaultLabels.length, 'possible labels...');
      
      // Run zero-shot classification
      const results = await this.classifier(audioData, this.defaultLabels);
      
      console.log('🎯 Raw CLAP results:', results);
      
      // Process and return top results
      const processedTags = this.processResults(results);
      console.log('📝 Processed tags:', processedTags);
      
      return processedTags;
      
    } catch (error) {
      console.error('❌ Error during audio processing:', error);
      throw new Error(`Audio processing failed: ${error.message}`);
    }
  }

  extractAudioData(audioBuffer) {
    console.log('🔧 Converting audio buffer:', {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels
    });
    
    // Get audio data - convert to mono if needed
    let audioArray;
    if (audioBuffer.numberOfChannels === 1) {
      audioArray = audioBuffer.getChannelData(0);
    } else {
      // Average multiple channels to mono
      const channel1 = audioBuffer.getChannelData(0);
      const channel2 = audioBuffer.getChannelData(1);
      audioArray = new Float32Array(channel1.length);
      for (let i = 0; i < channel1.length; i++) {
        audioArray[i] = (channel1[i] + channel2[i]) / 2;
      }
    }
    
    // Return in the format expected by transformers.js
    return {
      raw: audioArray,
      sampling_rate: audioBuffer.sampleRate
    };
  }

  processResults(results) {
    // Ensure we have results and they're in the expected format
    if (!results || !Array.isArray(results)) {
      console.warn('⚠️ Unexpected results format:', results);
      return this.getFallbackTags();
    }
    
    // Sort by confidence and take top 5
    const sortedResults = results
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    
    // Convert to our tag format
    const tags = sortedResults.map(result => ({
      label: result.label,
      confidence: Math.max(0, Math.min(1, result.score)) // Clamp between 0 and 1
    }));
    
    // Ensure we have at least some tags
    if (tags.length === 0) {
      return this.getFallbackTags();
    }
    
    return tags;
  }

  getFallbackTags() {
    return [
      { label: 'audio', confidence: 0.9 },
      { label: 'sound', confidence: 0.8 },
      { label: 'recording', confidence: 0.7 }
    ];
  }

  // Convert file to AudioBuffer
  async fileToAudioBuffer(file) {
    console.log('📁 Processing file:', file.name, 'Size:', Math.round(file.size / 1024), 'KB');
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      console.log('✅ Audio file decoded successfully');
      return audioBuffer;
    } catch (error) {
      console.error('❌ Failed to decode audio file:', error);
      throw new Error(`Failed to decode audio file: ${error.message}`);
    }
  }
}

export default CLAPProcessor;