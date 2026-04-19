import { useState, useRef, useEffect, Fragment } from 'react'
import axios from 'axios'
import './App.css'
import JSZip from 'jszip'
import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [selectedFiles, setSelectedFiles] = useState([])
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [fileList, setFileList] = useState([])
  const [kaijuMode, setKaijuMode] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [expandedRow, setExpandedRow] = useState(null)
  
  const [approvedFiles, setApprovedFiles] = useState(new Set())
  const [fileNotes, setFileNotes] = useState({})
  const [previewContent, setPreviewContent] = useState({ type: 'idle', data: null, isEditing: false, editBuffer: '' })
  
  const [isDrawing, setIsDrawing] = useState(false)
  const [editTool, setEditTool] = useState('brush') 
  const [editColor, setEditColor] = useState('#000000')
  const [canvasSnapshot, setCanvasSnapshot] = useState(null)
  
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)
  const [isRedactingAll, setIsRedactingAll] = useState(false) // Nowy stan dla masowej redakcji

  // --- STANY SUPABASE AUTH ---
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)
  const startPosRef = useRef({ x: 0, y: 0 })

  // --- LOGIKA SUPABASE AUTH ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setIsAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError('Login error: ' + error.message)
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setAuthError('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setAuthError('Registration error: ' + error.message)
    } else {
      setAuthError('Registration successful! You can now log in.')
      setIsRegistering(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  // --- POBIERANIE PLIKÓW ---
  const fetchFiles = async () => {
    if (!user) return; 

    try {
      const { data, error } = await supabase.from('files').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setFileList(data || [])
    } catch (error) {
      console.error("Błąd pobierania bazy Supabase:", error)
    }
  }

  useEffect(() => {
    if (user) {
      fetchFiles()
    }
  }, [user])

  // --- RESZTA LOGIKI KANWY I EDYCJI ---
  useEffect(() => {
    if (previewContent.isEditing && previewContent.type === 'image' && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      const img = new Image()
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
      }
      img.crossOrigin = "anonymous"
      img.src = previewContent.data
    }
  }, [previewContent.isEditing, previewContent.data, previewContent.type])

  const startDrawing = (e) => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    ctx.strokeStyle = editColor
    ctx.fillStyle = editColor
    ctx.lineWidth = Math.max(canvas.width * 0.015, 5)

    if (editTool === 'rect') {
      setCanvasSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height))
      startPosRef.current = { x, y }
    } else {
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
    setIsDrawing(true)
  }

  const draw = (e) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    if (editTool === 'rect') {
      ctx.putImageData(canvasSnapshot, 0, 0)
      const width = x - startPosRef.current.x
      const height = y - startPosRef.current.y
      ctx.fillRect(startPosRef.current.x, startPosRef.current.y, width, height)
    } else {
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    if (canvasRef.current && editTool === 'brush') {
      canvasRef.current.getContext('2d').closePath()
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files?.length) {
      setSelectedFiles(Array.from(e.target.files))
      setStatus({ type: 'idle', message: '' })
    }
  }

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false) }
  
  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.length) {
      setSelectedFiles(Array.from(e.dataTransfer.files))
      setStatus({ type: 'idle', message: '' })
    }
  }

  const triggerFileInput = () => fileInputRef.current.click()
  const toggleKaijuMode = () => setKaijuMode(!kaijuMode)

  const toggleDetails = async (index, fileRecord) => {
    // DODANO: Zabezpieczenie || !fileRecord
    if (expandedRow === index || !fileRecord) {
      setExpandedRow(null)
      setPreviewContent({ type: 'idle', data: null, isEditing: false, editBuffer: '' })
      return
    }

    setExpandedRow(index)
    
    if (!fileRecord.file_url) {
      setPreviewContent({ type: 'error', data: 'Brak adresu URL dla tego pliku.', isEditing: false, editBuffer: '' })
      return;
    }

    setPreviewContent({ type: 'loading', data: 'Loading preview from Vault...', isEditing: false, editBuffer: '' })

    try {
      const fileExt = fileRecord.extension;
      const url = fileRecord.file_url;

      if (['jpg', 'jpeg', 'png', 'svg'].includes(fileExt)) {
        setPreviewContent({ type: 'image', data: url, isEditing: false, editBuffer: '' })
      } else if (fileExt === 'pdf') {
        setPreviewContent({ type: 'pdf', data: url, isEditing: false, editBuffer: '' })
      } else if (['txt', 'md', 'csv'].includes(fileExt)) {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network response was not ok");
        const textData = await response.text();
        setPreviewContent({ type: 'text', data: textData, isEditing: false, editBuffer: textData })
      } else {
        setPreviewContent({ type: 'error', data: 'Preview format not supported.', isEditing: false, editBuffer: '' })
      }
    } catch (error) {
      console.error(error)
      setPreviewContent({ type: 'error', data: `Preview not available (${error.message})`, isEditing: false, editBuffer: '' })
    }
  }

  // --- ZAPISYWANIE EDYCJI (ZAMIANA PLIKU W CHMURZE) ---
  const handleSaveEdit = async (fileRecord) => {
    if (previewContent.type !== 'image' || !canvasRef.current) return;
    
    setPreviewContent(prev => ({ ...prev, data: 'Zapisywanie zmian w chmurze...' }));
    
    try {
      canvasRef.current.toBlob(async (blob) => {
        const newName = `redacted_${Date.now()}_${fileRecord.filename}`;
        
        // 1. Wgrywamy nową, zamazaną wersję do Supabase
        await supabase.storage.from('vault').upload(newName, blob);
        const { data: urlData } = supabase.storage.from('vault').getPublicUrl(newName);
        
        // 2. Podmieniamy URL w bazie danych
        await supabase.from('files').update({ file_url: urlData.publicUrl }).eq('filename', fileRecord.filename);
        
        setPreviewContent({ type: 'image', data: urlData.publicUrl, isEditing: false, editBuffer: '' });
        fetchFiles(); // Odśwież listę żeby mieć nowe linki
      }, 'image/jpeg', 0.95);
    } catch (error) {
      console.error(error);
      alert("Nie udało się zapisać zmian w bazie.");
    }
  }

  // --- POJEDYNCZA REDAKCJA AI OPENCV ---
  const handleIndividualRedact = async (fileRecord) => {
    setPreviewContent({ type: 'loading', data: 'AI Processing: Wysłano ładunek do OpenCV...', isEditing: false, editBuffer: '' });
    
    try {
      const response = await fetch(fileRecord.file_url);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('file', blob, fileRecord.filename);
      
      const pyRes = await axios.post(`${API_URL}/api/redact-face`, formData, { responseType: 'blob' });
      
      const newUrl = URL.createObjectURL(pyRes.data);
      setPreviewContent({ type: 'image', data: newUrl, isEditing: true, editBuffer: '' });
      
    } catch (error) {
      console.error(error);
      alert("Błąd przetwarzania algorytmu AI: " + error.message);
      
      // ZMIANA: Bezpieczne zamknięcie okienka zamiast toggleDetails(null, null)
      setExpandedRow(null);
      setPreviewContent({ type: 'idle', data: null, isEditing: false, editBuffer: '' });
    }
  }

  // --- MASOWA REDAKCJA AI OPENCV (REDACT ALL FACES) ---
  const handleRedactAllFaces = async () => {
    const imageFiles = fileList.filter(f => ['jpg', 'jpeg', 'png'].includes(f.extension));
    
    if (imageFiles.length === 0) {
      alert("Brak obrazów do przetworzenia w krypcie.");
      return;
    }
    
    if (!window.confirm(`Czy na pewno chcesz wysłać ${imageFiles.length} obrazów do algorytmu OpenCV i nadpisać je w bazie?`)) return;

    setIsRedactingAll(true);
    let success = 0;
    
    for (const f of imageFiles) {
       try {
         // Pobierz obecny plik z Supabase
         const response = await fetch(f.file_url);
         const blob = await response.blob();
         
         // Wyślij do backendu Pythona
         const formData = new FormData();
         formData.append('file', blob, f.filename);
         const pyRes = await axios.post(`${API_URL}/api/redact-face`, formData, { responseType: 'blob' });
         const newBlob = pyRes.data;
         
         // Wgraj nowy plik do Supabase
         const newName = `ai_redacted_${Date.now()}_${f.filename}`;
         await supabase.storage.from('vault').upload(newName, newBlob);
         const { data: urlData } = supabase.storage.from('vault').getPublicUrl(newName);
         
         // Zaktualizuj bazę danych dla tego pliku
         await supabase.from('files').update({ file_url: urlData.publicUrl }).eq('id', f.id);
         success++;
       } catch (err) {
         console.error(`Błąd przy pliku ${f.filename}:`, err);
       }
    }
    
    setIsRedactingAll(false);
    alert(`Zakończono! Pomyślnie zamazano twarze na ${success}/${imageFiles.length} obrazach.`);
    fetchFiles();
  };


  const handleDelete = async (fileRecord) => {
    const fileName = fileRecord.filename || fileRecord; 
    if (!window.confirm(`Are you sure you want to delete ${fileName}?`)) return;

    try {
      await supabase.from('files').delete().eq('filename', fileName);
      setFileList(prev => prev.filter(f => f.filename !== fileName));
      setApprovedFiles(prev => {
        const next = new Set(prev);
        next.delete(fileName);
        return next;
      });
      if (expandedRow !== null) setExpandedRow(null);
      setPreviewContent({ type: 'idle', data: null, isEditing: false, editBuffer: '' });
    } catch (error) {
      console.error(error);
      alert("Failed to delete file.");
    }
  };

  const handleApprove = (fileName) => setApprovedFiles(prev => new Set(prev).add(fileName))
  const handleApproveAll = () => setApprovedFiles(new Set(fileList.map(f => f.filename || f)))
  const handleNoteChange = (fileName, text) => setFileNotes(prev => ({ ...prev, [fileName]: text }))

  const handleDownloadAll = async () => {
    if (approvedFiles.size === 0) return;
    setIsDownloadingZip(true);

    try {
      const zip = new JSZip();
      const filenames = Array.from(approvedFiles);

      for (const fileName of filenames) {
        const fileRecord = fileList.find(f => (f.filename || f) === fileName);
        if (!fileRecord || !fileRecord.file_url) continue;

        const response = await fetch(fileRecord.file_url);
        if (!response.ok) throw new Error(`Nie udało się pobrać ${fileName}`);
        const blob = await response.blob();
        zip.file(fileName, blob);
      }

      const zipContent = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipContent);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'secured_vault.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error(error);
      alert("Failed to download ZIP archive.");
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleExportJSON = () => {
    const batchId = crypto.randomUUID(); 
    const exportData = Array.from(approvedFiles).map(fileName => {
      const fileData = fileList.find(f => (f.filename || f) === fileName) || {}
      const baseData = typeof fileData === 'string' ? { filename: fileName } : fileData
      const related = Array.from(approvedFiles).filter(f => f !== fileName);
      
      return {
        document_id: crypto.randomUUID(),
        batch_id: batchId,
        source_origin: "Gateway_Upload_Terminal_01",
        relations: { part_of_batch: true, related_files: related },
        ...baseData,
        operator_notes: fileNotes[fileName] || 'No extra context provided.',
        export_timestamp: new Date().toISOString()
      }
    })

    const vaultSchema = { schema_version: "1.2", export_session_id: batchId, total_files: exportData.length, exported_vault: exportData }
    const dataStr = JSON.stringify(vaultSchema, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `data_refinery_export_${batchId.split('-')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    setStatus({ type: 'loading', message: `Analizowanie ${selectedFiles.length} plików...` })

    let successCount = 0;
    let errors = [];

    for (const currentFile of selectedFiles) {
      try {
        const formData = new FormData()
        formData.append('file', currentFile)

        // 1. Backend sprawdza plik (wirusy / magia)
        await axios.post(`${API_URL}/api/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })

        // 2. Upload do Supabase
        const fileExt = currentFile.name.split('.').pop().toLowerCase()
        const filePath = `${Date.now()}_${currentFile.name}`
        const { error: uploadError } = await supabase.storage.from('vault').upload(filePath, currentFile)
        
        if (uploadError) throw uploadError

        // 3. Wpis do bazy z autoryzacją użytkownika
        const { data: urlData } = supabase.storage.from('vault').getPublicUrl(filePath)
        const { error: dbError } = await supabase.from('files').insert([{
          filename: currentFile.name,
          size_kb: Math.round(currentFile.size / 1024),
          extension: fileExt,
          file_url: urlData.publicUrl,
          user_id: user.id
        }])
        
        if (dbError) throw dbError
        successCount++;

      } catch (error) {
        console.error(`Błąd wgrywania pliku ${currentFile.name}:`, error);
        errors.push(currentFile.name);
      }
    }

    if (errors.length > 0) {
      setStatus({ type: 'error', message: `Wgrano: ${successCount}. Błędy dla: ${errors.join(', ')}` })
    } else {
      setStatus({ type: 'success', message: `Pomyślnie zweryfikowano i wgrano ${successCount} plików!` })
    }

    setSelectedFiles([])
    fetchFiles()
  }

  if (isAuthLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>Ładowanie sesji...</div>
  }

  if (!user) {
    return (
      <div className={`app-wrapper standard-theme`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2rem' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#38bdf8' }}>
            {isRegistering ? 'Create Operator ID' : 'Gateway Access'}
          </h2>
          <form onSubmit={isRegistering ? handleRegister : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="email" 
              placeholder="Operator ID (Email)" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              className="notes-input"
              style={{ minHeight: 'auto', padding: '0.75rem' }}
            />
            <input 
              type="password" 
              placeholder="Passcode (min. 6 chars)" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="notes-input"
              style={{ minHeight: 'auto', padding: '0.75rem' }}
            />
            <button type="submit" className="btn-primary">
              {isRegistering ? 'Register & Enter' : 'Authenticate'}
            </button>
          </form>
          
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button 
              onClick={() => {
                setIsRegistering(!isRegistering)
                setAuthError('')
              }} 
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {isRegistering ? 'Already have an ID? Login' : 'Need an ID? Register'}
            </button>
          </div>

          {authError && <p style={{ color: '#ef4444', marginTop: '1rem', textAlign: 'center' }}>{authError}</p>}
        </div>
      </div>
    )
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
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="mode-toggle" onClick={toggleKaijuMode}>
                {kaijuMode ? 'DISABLE KAIJU' : 'INIT KAIJU MODE'}
              </button>
              <button className="mode-toggle" onClick={handleLogout} style={{ borderColor: '#ef4444', color: '#ef4444' }}>
                LOGOUT
              </button>
            </div>
          </div>
          <p className="subtitle">Secure Unstructured Data Gateway</p>
        </header>

        <main className="main-content">
          <div className="card upload-section">
            <div 
              className={`drop-zone ${selectedFiles.length > 0 ? 'has-file' : ''} ${isDragging ? 'dragging' : ''}`} 
              onClick={triggerFileInput}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".pdf,.txt,.md,.csv,.svg,.jpg,.jpeg,.png"
                multiple
                style={{ display: 'none' }} 
              />
              
              <svg className="upload-icon" width="64" height="64" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
              
              {selectedFiles.length > 0 ? (
                <span className="file-name">Wybrano {selectedFiles.length} plik(ów) do wgrania</span>
              ) : (
                <span className="placeholder-text">
                  {isDragging ? 'Upuść ładunek tutaj!' : 'Wybierz lub upuść wiele plików naraz'}
                </span>
              )}
            </div>

            <button 
              className="btn-primary" 
              onClick={handleUpload} 
              disabled={selectedFiles.length === 0 || status.type === 'loading'}
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
              <div className="header-actions">
                <span className="badge-success">{fileList.length} Files</span>
                
                {/* NOWY PRZYCISK: GLOBALNY REDACT OPENCV */}
                {fileList.filter(f => ['jpg', 'jpeg', 'png'].includes(f.extension)).length > 0 && (
                  <button 
                    className="btn-export" 
                    onClick={handleRedactAllFaces}
                    disabled={isRedactingAll}
                    style={{ backgroundColor: '#1e293b', borderColor: '#38bdf8', color: '#38bdf8' }}
                  >
                    {isRedactingAll ? 'Redacting AI...' : 'Redact All Faces'}
                  </button>
                )}

                {fileList.length > 0 && approvedFiles.size < fileList.length && (
                  <button className="btn-approve-all" onClick={handleApproveAll}>
                    Approve All
                  </button>
                )}

                {approvedFiles.size > 0 && (
                  <>
                    <button 
                      className="btn-export" 
                      onClick={handleDownloadAll}
                      disabled={isDownloadingZip}
                      style={{ opacity: isDownloadingZip ? 0.7 : 1 }}
                    >
                      {isDownloadingZip ? 'Zipping...' : 'Download ZIP'}
                    </button>
                    <button className="btn-export" onClick={handleExportJSON}>
                      Export JSON
                    </button>
                  </>
                )}
              </div>
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
                      const fileName = f.filename
                      const isApproved = approvedFiles.has(fileName)

                      return (
                        <Fragment key={index}>
                          <tr>
                            <td className="file-cell">
                              <span className="tooltip-trigger" data-tooltip={fileName}>
                                {fileName}
                              </span>
                            </td>
                            <td>
                              {isApproved ? (
                                <span className="status-badge safe">APPROVED</span>
                              ) : (
                                <span className="status-badge review">NEEDS REVIEW</span>
                              )}
                            </td>
                            <td className="text-right actions-cell">
                              <button className="action-btn" onClick={() => toggleDetails(index, f)}>Details</button>
                              {!isApproved && (
                                <button className="action-btn approve-btn" onClick={() => handleApprove(fileName)}>Approve</button>
                              )}
                              {isApproved && (
                                <button className="action-btn" onClick={() => window.open(f.file_url, '_blank')}>Download</button>
                              )}
                              <button 
                                className="action-btn" 
                                style={{ color: '#ef4444', borderColor: '#ef4444' }} 
                                onClick={() => handleDelete(f)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                          {expandedRow === index && (
                            <tr className="details-row">
                              <td colSpan="3">
                                <div className="details-pane">
                                  <div className="details-grid">
                                    <div className="detail-group">
                                      <span className="detail-label">Analysis Status</span>
                                      <span className="detail-value highlight">{f.status || 'CLEANED'}</span>
                                    </div>
                                    <div className="detail-group">
                                      <span className="detail-label">Payload Size</span>
                                      <span className="detail-value">{f.size_kb ? `${f.size_kb} KB` : 'N/A'}</span>
                                    </div>
                                    <div className="detail-group">
                                      <span className="detail-label">Format</span>
                                      <span className="detail-value">{f.extension || 'RAW'}</span>
                                    </div>
                                    <div className="detail-group">
                                      <span className="detail-label">Security Check</span>
                                      <span className="detail-value success-text">PASSED</span>
                                    </div>
                                  </div>

                                  <div className="preview-section">
                                    <span className="detail-label">Sanitized Data Preview</span>
                                    <div className="preview-container">
                                      {previewContent.type === 'loading' && <span className="preview-text">{previewContent.data}</span>}
                                      {previewContent.type === 'error' && <span className="preview-text error">{previewContent.data}</span>}
                                      
                                      {previewContent.type === 'text' && (
                                        <div className="text-editor-container">
                                          {previewContent.isEditing ? (
                                            <>
                                              <textarea
                                                className="preview-textarea"
                                                value={previewContent.editBuffer}
                                                onChange={(e) => setPreviewContent({ ...previewContent, editBuffer: e.target.value })}
                                              />
                                              <div className="editor-actions">
                                                <button className="action-btn" onClick={() => setPreviewContent({ ...previewContent, isEditing: false })}>Cancel</button>
                                                <button className="action-btn approve-btn" onClick={() => handleSaveEdit(f)}>Save Changes</button>
                                              </div>
                                            </>
                                          ) : (
                                            <>
                                              <pre className="preview-text">{previewContent.data}</pre>
                                              <div className="editor-actions">
                                                <button className="action-btn" onClick={() => setPreviewContent({ ...previewContent, isEditing: true })}>Edit Text (Redact)</button>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      )}

                                      {previewContent.type === 'image' && (
                                        <div className="text-editor-container">
                                          {previewContent.isEditing ? (
                                            <>
                                              <div className="canvas-toolbar">
                                                <div className="toolbar-group">
                                                  <label>Tool:</label>
                                                  <select value={editTool} onChange={(e) => setEditTool(e.target.value)}>
                                                    <option value="brush">Freehand Brush</option>
                                                    <option value="rect">Solid Rectangle</option>
                                                  </select>
                                                </div>
                                                <div className="toolbar-group">
                                                  <label>Color:</label>
                                                  <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} />
                                                </div>
                                              </div>
                                              <div className="canvas-wrapper">
                                                <canvas
                                                  ref={canvasRef}
                                                  className="preview-canvas"
                                                  onMouseDown={startDrawing}
                                                  onMouseMove={draw}
                                                  onMouseUp={stopDrawing}
                                                  onMouseLeave={stopDrawing}
                                                  style={{
                                                    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="${encodeURIComponent(editColor)}" stroke-width="2"><circle cx="16" cy="16" r="6" /><line x1="16" y1="12" x2="16" y2="20" /><line x1="12" y1="16" x2="20" y2="16" /></svg>') 16 16, crosshair`
                                                  }}
                                                />
                                              </div>
                                              <div className="editor-actions">
                                                <button className="action-btn" onClick={() => setPreviewContent({ ...previewContent, isEditing: false })}>Cancel</button>
                                                <button className="action-btn approve-btn" onClick={() => handleSaveEdit(f)}>Save Changes</button>
                                              </div>
                                            </>
                                          ) : (
                                            <>
                                              {/* Podgląd normalnego obrazka */}
                                              <img src={previewContent.data} alt="Preview" className="preview-image" />
                                              <div className="editor-actions" style={{ display: 'flex', gap: '10px' }}>
                                                <button className="action-btn" onClick={() => setPreviewContent({ ...previewContent, isEditing: true })}>
                                                  Manual Redact (Canvas)
                                                </button>
                                                
                                                {/* NOWY PRZYCISK: INDYWIDUALNY OPENCV REDACT */}
                                                <button 
                                                  className="action-btn" 
                                                  style={{ borderColor: '#38bdf8', color: '#38bdf8' }} 
                                                  onClick={() => handleIndividualRedact(f)}
                                                >
                                                  AI Face Redact (OpenCV)
                                                </button>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      )}

                                      {previewContent.type === 'pdf' && <iframe src={previewContent.data} title="PDF Preview" className="preview-pdf" />}
                                    </div>
                                  </div>

                                  <div className="enrichment-section">
                                    <span className="detail-label">Context Enrichment (Tags / Notes)</span>
                                    <textarea 
                                      className="notes-input" 
                                      placeholder="Operator notes, extracted PII info, metadata enrichment..."
                                      value={fileNotes[fileName] || ''}
                                      onChange={(e) => handleNoteChange(fileName, e.target.value)}
                                    />
                                  </div>
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