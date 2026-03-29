import { useState, useRef, useEffect, Fragment } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [fileList, setFileList] = useState([])
  const [kaijuMode, setKaijuMode] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [expandedRow, setExpandedRow] = useState(null)
  const fileInputRef = useRef(null)

  const fetchFiles = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/files')
      const files = response.data.files || response.data || []
      setFileList(Array.isArray(files) ? files : [])
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  const handleFileChange = (e) => {
    if (e.target.files?.length) {
      setFile(e.target.files[0])
      setStatus({ type: 'idle', message: '' })
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.length) {
      setFile(e.dataTransfer.files[0])
      setStatus({ type: 'idle', message: '' })
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current.click()
  }

  const toggleKaijuMode = () => {
    setKaijuMode(!kaijuMode)
  }

  const toggleDetails = (index) => {
    setExpandedRow(expandedRow === index ? null : index)
  }

  const handleDownload = (filename) => {
    window.open(`http://localhost:8000/api/download/${filename}`, '_blank')
  }

  const handleUpload = async () => {
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setStatus({ type: 'loading', message: 'Analyzing payload...' })

    try {
      await axios.post('http://localhost:8000/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      setStatus({ type: 'success', message: 'Payload verified and sanitized.' })
      setFile(null)
      fetchFiles()
    } catch (error) {
      if (error.response?.status === 415) {
        setStatus({ type: 'error', message: `Critical Threat: ${error.response.data.detail}` })
      } else {
        setStatus({ type: 'error', message: 'Connection timeout or server error.' })
      }
    }
  }

  return (
    <div className={`app-wrapper ${kaijuMode ? 'kaiju-theme' : 'standard-theme'}`}>
      
      {kaijuMode && (
        <div className="godzilla-container">
           <div className="css-godzilla">
             <div className="gz-tail"></div>
             <div className="gz-spike spike1"></div>
             <div className="gz-spike spike2"></div>
             <div className="gz-spike spike3"></div>
             <div className="gz-body"></div>
             <div className="gz-leg back-leg"></div>
             <div className="gz-leg front-leg"></div>
             <div className="gz-arm"></div>
             <div className="gz-head">
               <div className="gz-eye"></div>
               <div className="gz-jaw"></div>
               <div className="gz-fire"></div>
             </div>
           </div>
           <div className="flames"></div>
        </div>
      )}

      <div className="layout-container">
        <header className="header">
          <div className="header-top">
            <h1>The Data Refinery</h1>
            <button className="mode-toggle" onClick={toggleKaijuMode}>
              {kaijuMode ? 'DISABLE KAIJU' : 'INIT KAIJU MODE'}
            </button>
          </div>
          <p className="subtitle">Secure Unstructured Data Gateway</p>
        </header>

        <main className="main-content">
          <div className="card upload-section">
            <div 
              className={`drop-zone ${file ? 'has-file' : ''} ${isDragging ? 'dragging' : ''}`} 
              onClick={triggerFileInput}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
              />
              
              <svg className="upload-icon" width="64" height="64" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
              
              {file ? (
                <span className="file-name">{file.name}</span>
              ) : (
                <span className="placeholder-text">
                  {isDragging ? 'Drop payload here!' : 'Insert payload or drag and drop'}
                </span>
              )}
            </div>

            <button 
              className="btn-primary" 
              onClick={handleUpload} 
              disabled={!file || status.type === 'loading'}
            >
              {status.type === 'loading' ? 'Processing...' : 'Execute Protocol'}
            </button>

            {status.message && (
              <div className={`alert alert-${status.type}`}>
                {status.message}
              </div>
            )}
          </div>

          <div className="card results-section">
            <div className="results-header">
              <h3>Secured Vault</h3>
              <span className="badge-success">{fileList.length} Files</span>
            </div>
            
            {fileList.length > 0 ? (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fileList.map((f, index) => {
                      const fileName = f.filename || f
                      return (
                        <Fragment key={index}>
                          <tr>
                            <td className="file-cell">{fileName}</td>
                            <td><span className="status-badge safe">SANITIZED</span></td>
                            <td className="text-right actions-cell">
                              <button className="action-btn" onClick={() => toggleDetails(index)}>Details</button>
                              <button className="action-btn" onClick={() => handleDownload(fileName)}>Download</button>
                            </td>
                          </tr>
                          {expandedRow === index && (
                            <tr className="details-row">
                              <td colSpan="3">
                                <div className="details-content">
                                  <pre>{JSON.stringify(f, null, 2)}</pre>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">Vault is currently empty.</p>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App