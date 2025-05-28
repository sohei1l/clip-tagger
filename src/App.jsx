import { useState, useRef } from 'react'
import CLAPProcessor from './clapProcessor'
import './App.css'

function App() {
  const [audioFile, setAudioFile] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [tags, setTags] = useState([])
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const clapProcessorRef = useRef(null)

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file)
      processAudio(file)
    }
  }

  const handleDrop = (event) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file)
      processAudio(file)
    }
  }

  const handleDragOver = (event) => {
    event.preventDefault()
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      chunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        chunksRef.current.push(event.data)
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' })
        const file = new File([blob], 'recording.wav', { type: 'audio/wav' })
        setAudioFile(file)
        processAudio(file)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error accessing microphone:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const processAudio = async (file) => {
    setIsLoading(true)
    setTags([])
    setError(null)
    
    try {
      if (!clapProcessorRef.current) {
        clapProcessorRef.current = new CLAPProcessor()
      }
      
      const audioBuffer = await clapProcessorRef.current.fileToAudioBuffer(file)
      const generatedTags = await clapProcessorRef.current.processAudio(audioBuffer)
      
      setTags(generatedTags)
    } catch (err) {
      console.error('Error processing audio:', err)
      setError('Failed to process audio. Using fallback tags.')
      // Fallback tags
      setTags([
        { label: 'audio', confidence: 0.9 },
        { label: 'sound', confidence: 0.8 },
        { label: 'recording', confidence: 0.7 }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="app">
      <header>
        <h1>🎵 clip-tagger</h1>
        <p>Custom audio tagging in the browser</p>
      </header>

      <main>
        <div 
          className="upload-area"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            hidden
          />
          <div className="upload-content">
            {audioFile ? (
              <div>
                <p>📁 {audioFile.name}</p>
                <audio controls src={URL.createObjectURL(audioFile)} />
              </div>
            ) : (
              <div>
                <p>🎵 Drop an audio file here or click to upload</p>
                <p>Supports WAV, MP3, and other audio formats</p>
              </div>
            )}
          </div>
        </div>

        <div className="controls">
          <button 
            onClick={isRecording ? stopRecording : startRecording}
            className={isRecording ? 'recording' : ''}
          >
            {isRecording ? '⏹️ Stop Recording' : '🎤 Record Audio'}
          </button>
        </div>

        {isLoading && (
          <div className="loading">
            <p>🧠 Analyzing audio with CLAP model...</p>
          </div>
        )}

        {error && (
          <div className="error">
            <p>⚠️ {error}</p>
          </div>
        )}

        {tags.length > 0 && (
          <div className="tags-section">
            <h3>Generated Tags</h3>
            <div className="tags">
              {tags.map((tag, index) => (
                <span key={index} className="tag">
                  {tag.label} ({Math.round(tag.confidence * 100)}%)
                </span>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
