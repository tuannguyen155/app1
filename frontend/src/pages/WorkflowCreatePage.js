import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Document, Page, pdfjs } from 'react-pdf';
import Draggable from 'react-draggable';
import { Rnd } from 'react-rnd';
import { workflowsApi, usersApi, documentsApi, signaturesApi } from '../services/api';
import { FiUpload, FiPlus, FiTrash2, FiSave, FiSend, FiUser, FiFile, FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

// Setup PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

function WorkflowCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Step management
  const [step, setStep] = useState(1);
  
  // Workflow info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Files
  const [mainFile, setMainFile] = useState(null);
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [pdfFiles, setPdfFiles] = useState([]);
  
  // Signers
  const [signers, setSigners] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  
  // Signature positions - { signerId: { documentIndex: [ { type, x, y, width, height, page } ] } }
  const [signaturePositions, setSignaturePositions] = useState({});
  
  // Current signer being edited
  const [currentSignerIndex, setCurrentSignerIndex] = useState(0);
  
  // PDF viewer state
  const [numPages, setNumPages] = useState({});
  const [pdfLoaded, setPdfLoaded] = useState({});
  const [currentPage, setCurrentPage] = useState({}); // Per document
  const [pdfScale, setPdfScale] = useState(1.2);
  
  // Mutations
  const createWorkflowMutation = useMutation({
    mutationFn: (data) => workflowsApi.create(data),
  });
  
  const addDocumentMutation = useMutation({
    mutationFn: ({ workflowId, file, isMain }) => 
      workflowsApi.addDocument(workflowId, file, isMain),
  });
  
  const addSignerMutation = useMutation({
    mutationFn: ({ workflowId, userId, stepOrder }) => 
      workflowsApi.addSigner(workflowId, userId, stepOrder),
  });
  
  const setSignaturePositionsMutation = useMutation({
    mutationFn: ({ workflowId, signerId, positions }) => 
      workflowsApi.setSignerSignaturePositions(workflowId, signerId, positions),
  });
  
  const sendWorkflowMutation = useMutation({
    mutationFn: (workflowId) => workflowsApi.send(workflowId),
  });
  
  // Fetch available users
  useEffect(() => {
    usersApi.list().then(res => {
      setAvailableUsers(res.data);
    });
  }, []);
  
  // Handle main file upload
  const handleMainFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setMainFile(file);
      setPdfFiles([{ file, isMain: true, name: file.name, id: 'main' }]);
    } else if (file) {
      alert('Vui lòng chọn file PDF');
    }
  };
  
  // Handle attachment files upload
  const handleAttachmentFilesChange = (e) => {
    const files = Array.from(e.target.files);
    const newPdfFiles = [...pdfFiles];
    const newAttachmentFiles = [...attachmentFiles];
    
    files.forEach(file => {
      const isPdf = file.type === 'application/pdf';
      newAttachmentFiles.push({ file, isPdf, name: file.name });
      if (isPdf) {
        newPdfFiles.push({ file, isMain: false, name: file.name, id: `attach_${Date.now()}_${Math.random()}` });
      }
    });
    
    setAttachmentFiles(newAttachmentFiles);
    setPdfFiles(newPdfFiles);
  };
  
  // Add signer
  const handleAddSigner = (user) => {
    if (signers.find(s => s.user_id === user.id)) return;
    setSigners(prev => [...prev, { 
      user_id: user.id, 
      user: user,
      step_order: prev.length + 1 
    }]);
  };
  
  // Remove signer
  const handleRemoveSigner = (index) => {
    setSigners(prev => prev.filter((_, i) => i !== index));
  };
  
  // State for confirmed signer positions
  const [confirmedSigners, setConfirmedSigners] = useState({});
  
  // Check if workflow is locked (sent)
  const isWorkflowLocked = workflow?.status && workflow.status !== 'draft';
  
  // Initialize signature positions for a signer
  useEffect(() => {
    if (signers.length > 0 && pdfFiles.length > 0 && step === 4) {
      const signer = signers[currentSignerIndex];
      if (!signer) return;
      
      const key = signer.user_id;
      // Don't initialize if already confirmed
      if (confirmedSigners[key]) return;
      
      if (!signaturePositions[key]) {
        const positions = {};
        pdfFiles.forEach((pdf, docIndex) => {
          positions[docIndex] = [
            { type: 'signature', x: 50, y: 650, width: 150, height: 50, page: 1 },
            { type: 'date', x: 210, y: 660, width: 80, height: 25, page: 1 }
          ];
        });
        setSignaturePositions(prev => ({ ...prev, [key]: positions }));
      }
    }
  }, [signers, pdfFiles, step, currentSignerIndex, confirmedSigners]);
  
  // Confirm positions for current signer
  const handleConfirmSignerPositions = () => {
    const signer = signers[currentSignerIndex];
    if (!signer) return;
    
    const key = signer.user_id;
    const signerPositions = signaturePositions[key];
    
    if (!signerPositions) {
      alert('Chưa có vị trí ký cho người này');
      return;
    }
    
    // Check if at least one position exists
    const hasPositions = Object.values(signerPositions).some(arr => arr && arr.length > 0);
    if (!hasPositions) {
      alert('Vui lòng thêm ít nhất một vị trí ký');
      return;
    }
    
    setConfirmedSigners(prev => ({ ...prev, [key]: true }));
    alert(`Đã xác nhận vị trí ký cho ${signer.user?.full_name || signer.user?.email}`);
  };
  
  // Unconfirm signer to edit again
  const handleUnconfirmSigner = (signerIndex) => {
    const signer = signers[signerIndex];
    if (!signer) return;
    const key = signer.user_id;
    setConfirmedSigners(prev => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  };
  
  // Handle drag
  const handleDrag = (signerId, docIndex, type, e, data) => {
    const key = signerId;
    if (signaturePositions[key] && signaturePositions[key][docIndex]) {
      const newPositions = { ...signaturePositions[key] };
      const posIndex = newPositions[docIndex].findIndex(p => p.type === type);
      if (posIndex >= 0) {
        // Convert from pixel coordinates to PDF coordinates
        // PDF coordinate system starts from bottom-left
        newPositions[docIndex][posIndex] = {
          ...newPositions[docIndex][posIndex],
          x: Math.max(0, data.x / pdfScale),
          y: Math.max(0, 700 - data.y / pdfScale) // Invert and offset
        };
        setSignaturePositions(prev => ({ ...prev, [key]: newPositions }));
      }
    }
  };
  
  // Handle resize
  const handleResize = (signerId, docIndex, type, delta, position) => {
    const key = signerId;
    if (signaturePositions[key] && signaturePositions[key][docIndex]) {
      const newPositions = { ...signaturePositions[key] };
      const posIndex = newPositions[docIndex].findIndex(p => p.type === type);
      if (posIndex >= 0) {
        const oldPos = newPositions[docIndex][posIndex];
        newPositions[docIndex][posIndex] = {
          ...oldPos,
          x: Math.max(0, position.x / pdfScale),
          y: Math.max(0, 700 - position.y / pdfScale),
          width: Math.max(50, oldPos.width + delta.width / pdfScale),
          height: Math.max(30, oldPos.height + delta.height / pdfScale)
        };
        setSignaturePositions(prev => ({ ...prev, [key]: newPositions }));
      }
    }
  };
  
  // Add new signature/date position for a document
  const handleAddPosition = (signerKey, docIndex, type) => {
    if (signaturePositions[signerKey] && signaturePositions[signerKey][docIndex]) {
      const newPositions = { ...signaturePositions[signerKey] };
      newPositions[docIndex] = [
        ...newPositions[docIndex],
        { type, x: 50, y: 650, width: type === 'signature' ? 150 : 80, height: type === 'signature' ? 50 : 25, page: 1 }
      ];
      setSignaturePositions(prev => ({ ...prev, [signerKey]: newPositions }));
    }
  };
  
  // Remove a position
  const handleRemovePosition = (signerKey, docIndex, posIndex) => {
    if (signaturePositions[signerKey] && signaturePositions[signerKey][docIndex]) {
      const newPositions = { ...signaturePositions[signerKey] };
      newPositions[docIndex] = newPositions[docIndex].filter((_, i) => i !== posIndex);
      setSignaturePositions(prev => ({ ...prev, [signerKey]: newPositions }));
    }
  };
  
  // Get position for display (convert PDF coords to pixel coords)
  const getDisplayPosition = (pos) => {
    return {
      x: pos.x * pdfScale,
      y: (700 - pos.y) * pdfScale, // Convert from PDF to display coords
      width: pos.width * pdfScale,
      height: pos.height * pdfScale
    };
  };
  
  // onDocumentLoadSuccess
  const onDocumentLoadSuccess = (docIndex, numPages) => {
    setNumPages(prev => ({ ...prev, [docIndex]: numPages }));
    setPdfLoaded(prev => ({ ...prev, [docIndex]: true }));
    setCurrentPage(prev => ({ ...prev, [docIndex]: 1 }));
  };
  
  // Create workflow and save all data
  const handleSaveAndSend = async () => {
    try {
      // Step 1: Create workflow
      const workflowRes = await createWorkflowMutation.mutateAsync({ title, description });
      const workflowId = workflowRes.data.id;
      
      // Step 2: Upload main file
      if (mainFile) {
        await addDocumentMutation.mutateAsync({ 
          workflowId, 
          file: mainFile, 
          isMain: true 
        });
      }
      
      // Step 3: Upload attachments (only PDF files)
      for (const pdfFile of pdfFiles.filter(p => !p.isMain)) {
        await addDocumentMutation.mutateAsync({ 
          workflowId, 
          file: pdfFile.file, 
          isMain: false 
        });
      }
      
      // Step 4: Add signers
      for (const signer of signers) {
        await addSignerMutation.mutateAsync({
          workflowId,
          userId: signer.user_id,
          stepOrder: signer.step_order
        });
      }
      
      // Step 5: Get workflow to get document IDs and signer IDs
      const workflowDetail = await workflowsApi.get(workflowId).then(res => res.data);
      
      // Step 6: Set signature positions
      for (const signer of workflowDetail.signers) {
        const signerPositions = signaturePositions[signer.user_id];
        if (signerPositions) {
          const positions = [];
          Object.entries(signerPositions).forEach(([docIndex, posList]) => {
            const docId = workflowDetail.documents[parseInt(docIndex)]?.id;
            if (docId) {
              posList.forEach(pos => {
                positions.push({
                  document_id: docId,
                  x: pos.x,
                  y: pos.y,
                  width: pos.width,
                  height: pos.height,
                  page: pos.page,
                  type: pos.type
                });
              });
            }
          });
          
          await setSignaturePositionsMutation.mutateAsync({
            workflowId,
            signerId: signer.id,
            positions
          });
        }
      }
      
      // Step 7: Send workflow
      await sendWorkflowMutation.mutateAsync(workflowId);
      
      navigate(`/workflow/${workflowId}`);
      
    } catch (error) {
      console.error('Error saving workflow:', error);
      alert('Có lỗi xảy ra khi lưu workflow: ' + (error.message || 'Unknown error'));
    }
  };
  
  // Render step indicator
  const renderStepIndicator = () => (
    <div className="workflow-steps">
      {[1, 2, 3, 4].map((s, i) => (
        <React.Fragment key={s}>
          <div className={`step ${step >= s ? 'active' : ''}`}>
            <div className="step-number">{s}</div>
            <span>
              {s === 1 ? 'Thông tin' : 
               s === 2 ? 'Upload file' : 
               s === 3 ? 'Người ký' : 'Vị trí ký'}
            </span>
          </div>
          {i < 3 && <div className="step-line"></div>}
        </React.Fragment>
      ))}
    </div>
  );
  
  // Render Step 1: Info
  const renderStep1 = () => (
    <div className="card">
      <h2 className="card-title">Thông tin Workflow</h2>
      <div className="form-group">
        <label className="form-label">Tiêu đề *</label>
        <input
          type="text"
          className="form-input"
          placeholder="Nhập tiêu đề workflow"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label className="form-label">Mô tả</label>
        <textarea
          className="form-input"
          rows={4}
          placeholder="Nhập mô tả (tùy chọn)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          className="btn btn-primary"
          onClick={() => setStep(2)}
          disabled={!title}
        >
          Tiếp theo
        </button>
      </div>
    </div>
  );
  
  // Render Step 2: Upload Files
  const renderStep2 = () => (
    <div className="card">
      <h2 className="card-title">Upload File</h2>
      
      {/* Main File */}
      <div className="form-group">
        <label className="form-label">File PDF chính *</label>
        <input
          type="file"
          accept=".pdf"
          onChange={handleMainFileChange}
          style={{ marginBottom: '10px' }}
        />
        {mainFile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'green' }}>
            <FiFile /> {mainFile.name}
          </div>
        )}
      </div>
      
      {/* Attachment Files */}
      <div className="form-group">
        <label className="form-label">File đính kèm (Chỉ PDF mới được ký)</label>
        <input
          type="file"
          multiple
          onChange={handleAttachmentFilesChange}
          style={{ marginBottom: '10px' }}
        />
        {attachmentFiles.length > 0 && (
          <div>
            {attachmentFiles.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <FiFile style={{ color: f.isPdf ? 'green' : 'gray' }} />
                <span>{f.name}</span>
                <span className="badge" style={{ fontSize: '10px' }}>
                  {f.isPdf ? 'PDF (sẽ ký)' : 'Giữ nguyên'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn btn-secondary" onClick={() => setStep(1)}>
          Quay lại
        </button>
        <button 
          className="btn btn-primary"
          onClick={() => setStep(3)}
          disabled={!mainFile}
        >
          Tiếp theo
        </button>
      </div>
    </div>
  );
  
  // Render Step 3: Signers
  const renderStep3 = () => (
    <div className="card">
      <h2 className="card-title">Người ký theo thứ tự</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Available Users */}
        <div>
          <h3 style={{ marginBottom: '12px' }}>Chọn người ký</h3>
          {availableUsers
            .filter(u => !signers.find(s => s.user_id === u.id))
            .map(user => (
              <div
                key={user.id}
                onClick={() => handleAddSigner(user)}
                style={{
                  padding: '12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FiUser />
                <div>
                  <div>{user.full_name || user.email}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{user.email}</div>
                </div>
              </div>
            ))}
        </div>
        
        {/* Selected Signers */}
        <div>
          <h3 style={{ marginBottom: '12px' }}>Thứ tự ký ({signers.length} người)</h3>
          {signers.length === 0 ? (
            <div style={{ color: '#64748b', padding: '20px', textAlign: 'center' }}>
              Chưa có người ký nào
            </div>
          ) : (
            signers.map((signer, index) => (
              <div
                key={index}
                style={{
                  padding: '12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="badge badge-in_progress">{index + 1}</span>
                  <div>
                    <div>{signer.user?.full_name || signer.user?.email}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{signer.user?.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveSigner(index)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red' }}
                >
                  <FiTrash2 />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
        <button className="btn btn-secondary" onClick={() => setStep(2)}>
          Quay lại
        </button>
        <button 
          className="btn btn-primary"
          onClick={() => {
            setStep(4);
          }}
          disabled={signers.length === 0}
        >
          Tiếp theo
        </button>
      </div>
    </div>
  );
  
  // Render Step 4: Signature Positions
  const renderStep4 = () => {
    const currentSigner = signers[currentSignerIndex];
    if (!currentSigner) return null;
    
    const key = currentSigner.user_id;
    const positions = signaturePositions[key] || {};
    
    return (
      <div className="card">
        <h2 className="card-title">
          Chọn vị trí ký - Người thứ {currentSignerIndex + 1}: {currentSigner.user?.full_name || currentSigner.user?.email}
        </h2>
        
        {/* Signer tabs with status indicators */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {signers.map((s, i) => {
            const signerKey = s.user_id;
            const isConfirmed = confirmedSigners[signerKey];
            const hasPositions = signaturePositions[signerKey] && 
              Object.values(signaturePositions[signerKey]).some(arr => arr && arr.length > 0);
            return (
              <button
                key={i}
                className={`btn ${currentSignerIndex === i ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setCurrentSignerIndex(i)}
                disabled={isConfirmed}
                style={{
                  position: 'relative',
                  borderWidth: isConfirmed ? '2px' : hasPositions ? '2px' : '1px',
                  borderColor: isConfirmed ? '#7c3aed' : hasPositions ? '#10b981' : undefined,
                  background: isConfirmed ? '#ede9fe' : undefined,
                  opacity: isConfirmed ? 0.7 : 1
                }}
              >
                {i + 1}. {s.user?.full_name || s.user?.email?.split('@')[0]}
                {isConfirmed && (
                  <span style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    width: '12px',
                    height: '12px',
                    background: '#7c3aed',
                    borderRadius: '50%',
                    border: '2px solid white'
                  }}></span>
                )}
                {!isConfirmed && hasPositions && (
                  <span style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    width: '12px',
                    height: '12px',
                    background: '#10b981',
                    borderRadius: '50%',
                    border: '2px solid white'
                  }}></span>
                )}
              </button>
            );
          })}
        </div>
        
        {/* Show status of all signers */}
        <div style={{ marginBottom: '16px', padding: '12px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
          <div style={{ fontSize: '12px', color: '#0369a1', marginBottom: '8px' }}>
            <strong>Trạng thái vị trí ký:</strong>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {signers.map((s, i) => {
              const signerKey = s.user_id;
              const isConfirmed = confirmedSigners[signerKey];
              const posCount = signaturePositions[signerKey] ? 
                Object.values(signaturePositions[signerKey]).reduce((sum, arr) => sum + (arr?.length || 0), 0) : 0;
              const isCurrent = i === currentSignerIndex;
              return (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  background: isConfirmed ? '#ede9fe' : isCurrent ? '#dbeafe' : posCount > 0 ? '#d1fae5' : '#f3f4f6',
                  borderRadius: '6px',
                  opacity: isConfirmed ? 0.7 : 1,
                  border: isConfirmed ? '1px solid #7c3aed' : undefined
                }}>
                  <span style={{ fontWeight: '500', fontSize: '12px' }}>{i + 1}. {s.user?.full_name || s.user?.email?.split('@')[0]}</span>
                  <span style={{ fontSize: '11px', color: isConfirmed ? '#6d28d9' : isCurrent ? '#1d4ed8' : posCount > 0 ? '#065f46' : '#6b7280' }}>
                    {isConfirmed ? '✓ Đã xác nhận' : isCurrent ? '(đang chọn)' : posCount > 0 ? `✓ ${posCount} vị trí` : 'chưa chọn'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Confirm button for current signer */}
        {(() => {
          const signer = signers[currentSignerIndex];
          if (!signer) return null;
          const signerKey = signer.user_id;
          const isConfirmed = confirmedSigners[signerKey];
          
          if (isConfirmed) {
            return (
              <div style={{ 
                marginBottom: '16px', 
                padding: '16px', 
                background: '#f3e8ff', 
                borderRadius: '8px', 
                border: '2px solid #7c3aed',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <strong style={{ color: '#7c3aed' }}>✓ Đã xác nhận vị trí ký</strong>
                  <p style={{ fontSize: '12px', color: '#6d28d9', margin: '4px 0 0' }}>
                    Vị trí ký cho {signer.user?.full_name || signer.user?.email} đã được xác nhận. Chuyển sang người ký tiếp theo.
                  </p>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleUnconfirmSigner(currentSignerIndex)}
                >
                  📝 Sửa lại
                </button>
              </div>
            );
          }
          
          return (
            <div style={{ 
              marginBottom: '16px', 
              padding: '12px', 
              background: '#ecfdf5', 
              borderRadius: '8px', 
              border: '1px solid #10b981'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: '#065f46' }}>Xác nhận vị trí ký</strong>
                  <p style={{ fontSize: '12px', color: '#047857', margin: '4px 0 0' }}>
                    Sau khi chọn vị trí ảnh ký và ngày ký, nhấn xác nhận để khóa vị trí cho người ký này
                  </p>
                </div>
                <button
                  className="btn btn-success"
                  onClick={handleConfirmSignerPositions}
                >
                  ✓ Xác nhận
                </button>
              </div>
            </div>
          );
        })()}
        
        {/* Legend and Add buttons */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '20px', background: 'rgba(37, 99, 235, 0.3)', border: '2px solid #2563eb', borderRadius: '4px' }}></div>
            <span>Ảnh chữ ký</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '20px', background: 'rgba(16, 185, 129, 0.3)', border: '2px solid #10b981', borderRadius: '4px' }}></div>
            <span>Ngày ký (dd/mm/yyyy)</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleAddPosition(key, currentSignerIndex, 'signature')}
            >
              <FiPlus style={{ marginRight: '4px' }} /> Thêm ảnh ký
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleAddPosition(key, currentSignerIndex, 'date')}
            >
              <FiPlus style={{ marginRight: '4px' }} /> Thêm ngày ký
            </button>
          </div>
        </div>
        
        {/* PDF Files with signature positions */}
        {pdfFiles.map((pdf, docIndex) => (
          <div key={docIndex} style={{ marginBottom: '32px' }}>
            <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiFile />
              {pdf.name}
              {pdf.isMain && <span className="badge badge-in_progress">File chính</span>}
            </h3>
            
            {/* PDF Viewer */}
            <div style={{ position: 'relative', background: '#525659', padding: '20px', borderRadius: '8px', overflow: 'auto' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <Document
                  file={pdf.file}
                  onLoadSuccess={(pdf) => onDocumentLoadSuccess(docIndex, pdf.numPages)}
                  loading={<div style={{ color: 'white' }}>Loading PDF...</div>}
                >
                  {pdfLoaded[docIndex] && (
                    <Page
                      pageNumber={currentPage[docIndex] || 1}
                      scale={pdfScale}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  )}
                </Document>
                
                {/* Only show positions for current signer if not confirmed */}
                {!confirmedSigners[key] && (
                  <React.Fragment>
                    {/* Ghost positions from other signers */}
                    {signers.map((otherSigner, otherIdx) => {
                      if (otherIdx === currentSignerIndex) return null;
                      const otherKey = otherSigner.user_id;
                      const otherPositions = signaturePositions[otherKey]?.[docIndex];
                      if (!otherPositions || otherPositions.length === 0) return null;
                      
                      return otherPositions.map((pos, posIdx) => {
                        const displayPos = getDisplayPosition(pos);
                        return (
                          <div
                            key={`ghost-${otherIdx}-${posIdx}`}
                            style={{
                              position: 'absolute',
                              left: displayPos.x,
                              top: displayPos.y,
                              width: displayPos.width,
                              height: displayPos.height,
                              border: `2px dashed #9ca3af`,
                              backgroundColor: 'rgba(156, 163, 175, 0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: '400',
                              color: '#6b7280',
                              borderRadius: '4px',
                              zIndex: 5,
                              pointerEvents: 'none'
                            }}
                          >
                            {pos.type === 'signature' ? '✍️' : '📅'} {otherIdx + 1}
                          </div>
                        );
                      });
                    })}
                    
                    {/* Current signer's signature and date boxes */}
                    {positions[docIndex]?.map((pos, posIndex) => {
                      const displayPos = getDisplayPosition(pos);
                      return (
                        <Rnd
                          key={posIndex}
                          size={{ width: displayPos.width, height: displayPos.height }}
                          position={{ x: displayPos.x, y: displayPos.y }}
                          bounds="parent"
                          minWidth={50}
                          minHeight={30}
                          onDragStop={(e, d) => handleDrag(key, docIndex, pos.type, e, d)}
                          onResizeStop={(e, direction, ref, delta, position) => handleResize(key, docIndex, pos.type, delta, position)}
                          style={{
                            border: `2px ${pos.type === 'signature' ? 'solid #2563eb' : 'solid #10b981'}`,
                            backgroundColor: pos.type === 'signature' ? 'rgba(37, 99, 235, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: '500',
                            cursor: 'move',
                            borderRadius: '4px',
                            zIndex: 10
                          }}
                        >
                          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {pos.type === 'signature' ? '✍️ Chữ ký' : '📅 Ngày ký'}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemovePosition(key, docIndex, posIndex); }}
                              style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                border: 'none',
                                background: '#dc2626',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px'
                              }}
                              title="Xóa"
                            >
                              ×
                            </button>
                          </div>
                        </Rnd>
                      );
                    })}
                  </React.Fragment>
                )}
                
                {/* Show confirmed positions as static (locked) */}
                {confirmedSigners[key] && positions[docIndex]?.map((pos, posIndex) => {
                  const displayPos = getDisplayPosition(pos);
                  return (
                    <div
                      key={`confirmed-${posIndex}`}
                      style={{
                        position: 'absolute',
                        left: displayPos.x,
                        top: displayPos.y,
                        width: displayPos.width,
                        height: displayPos.height,
                        border: `2px solid #7c3aed`,
                        backgroundColor: 'rgba(124, 58, 237, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: '500',
                        color: '#7c3aed',
                        borderRadius: '4px',
                        zIndex: 10
                      }}
                    >
                      {pos.type === 'signature' ? '✍️ Đã xác nhận' : '📅 Đã xác nhận'}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Page navigation */}
            {numPages[docIndex] > 1 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage(prev => ({ ...prev, [docIndex]: Math.max(1, (prev[docIndex] || 1) - 1) }))}
                  disabled={(currentPage[docIndex] || 1) <= 1}
                >
                  <FiChevronLeft />
                </button>
                <span>Trang {(currentPage[docIndex] || 1)} / {numPages[docIndex]}</span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage(prev => ({ ...prev, [docIndex]: Math.min(numPages[docIndex], (prev[docIndex] || 1) + 1) }))}
                  disabled={(currentPage[docIndex] || 1) >= numPages[docIndex]}
                >
                  <FiChevronRight />
                </button>
              </div>
            )}
          </div>
        ))}
        
        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setStep(3)}
          >
            Quay lại
          </button>
          
          {/* Validation: require all signers confirmed */}
          {(() => {
            const allConfirmed = signers.every(s => confirmedSigners[s.user_id]);
            if (!allConfirmed) {
              const confirmedCount = Object.keys(confirmedSigners).length;
              return (
                <div style={{ 
                  padding: '12px 16px', 
                  background: '#fef3c7', 
                  border: '1px solid #f59e0b', 
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#92400e'
                }}>
                  ⚠️ <strong>Cảnh báo:</strong> Cần xác nhận vị trí ký cho tất cả {signers.length} người ký (đã xác nhận: {confirmedCount}/{signers.length})
                </div>
              );
            }
            return null;
          })()}
          
          <button 
            className="btn btn-success"
            onClick={handleSaveAndSend}
            disabled={createWorkflowMutation.isPending || sendWorkflowMutation.isPending}
          >
            {createWorkflowMutation.isPending ? 'Đang lưu...' : 'Lưu & Gửi'}
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <div>
      <div className="header">
        <h1 className="header-title">Tạo Workflow mới</h1>
      </div>
      
      {renderStepIndicator()}
      
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
    </div>
  );
}

export default WorkflowCreatePage;
