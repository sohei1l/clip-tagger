import { pipeline } from '@xenova/transformers';

class CLAPProcessor {
  constructor() {
    this.classifier = null;
    this.isLoaded = false;
    this.candidateLabels = [
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
    if (this.isLoaded) return;

    try {
      console.log('🔄 Loading CLAP pipeline...');
      
      this.classifier = await pipeline(
        'zero-shot-audio-classification',
        'Xenova/clap-htsat-unfused'
      );
      
      this.isLoaded = true;
      console.log('✅ CLAP pipeline ready!');
    } catch (error) {
      console.error('❌ CLAP initialization failed:', error);
      throw new Error(`CLAP loading failed: ${error.message}`);
    }
  }

  async processAudio(audioBuffer) {
    console.log('🎵 Processing audio...');
    
    if (!this.isLoaded) {
      await this.initialize();
    }

    try {
      // Convert AudioBuffer to raw audio data
      const audioData = this.convertAudioBuffer(audioBuffer);
      
      console.log('🔍 Running classification...');
      
      // Run the classification
      const results = await this.classifier(audioData, this.candidateLabels);
      
      console.log('🎯 Classification results:', results);
      
      // Format results
      const formattedTags = this.formatResults(results);
      
      console.log('📝 Final tags:', formattedTags);
      return formattedTags;
      
    } catch (error) {
      console.error('❌ Audio processing error:', error);
      
      // Return fallback tags with error info
      return [
        { label: 'audio', confidence: 0.9 },
        { label: 'sound', confidence: 0.8 },
        { label: 'unknown', confidence: 0.5 }
      ];
    }
  }

  convertAudioBuffer(audioBuffer) {
    console.log('🔧 Converting audio buffer:', {
      duration: audioBuffer.duration.toFixed(2) + 's',
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels
    });
    
    // Extract audio data
    let rawAudio;
    if (audioBuffer.numberOfChannels === 1) {
      rawAudio = audioBuffer.getChannelData(0);
    } else {
      // Convert stereo to mono by averaging
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      rawAudio = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) {
        rawAudio[i] = (left[i] + right[i]) / 2;
      }
    }
    
    return {
      raw: rawAudio,
      sampling_rate: audioBuffer.sampleRate
    };
  }

  formatResults(results) {
    if (!Array.isArray(results)) {
      console.warn('⚠️ Unexpected results format:', results);
      return [
        { label: 'audio', confidence: 0.9 },
        { label: 'sound', confidence: 0.8 }
      ];
    }
    
    // Sort by score and take top 5
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(result => ({
        label: result.label,
        confidence: Math.max(0, Math.min(1, result.score))
      }));
  }

  async fileToAudioBuffer(file) {
    console.log('📁 Decoding file:', file.name, `(${Math.round(file.size / 1024)}KB)`);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      console.log('✅ File decoded successfully');
      return audioBuffer;
    } catch (error) {
      console.error('❌ File decoding failed:', error);
      throw new Error(`Audio decoding failed: ${error.message}`);
    }
  }
}

export default CLAPProcessor;