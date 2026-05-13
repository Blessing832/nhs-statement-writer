'use client'
import { useState, useCallback, useId } from 'react'

interface FileDropZoneProps {
  onText: (text: string) => void
  disabled?: boolean
}

const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function FileDropZone({ onText, disabled }: FileDropZoneProps) {
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputId = useId()

  const processFile = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/parse-doc', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) onText(data.text)
      else alert(data.error || 'Could not read file')
    } finally {
      setUploading(false)
    }
  }, [onText])

  const isDisabled = disabled || uploading

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    if (isDisabled) return
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [isDisabled, processFile])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDisabled) setDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={[
        'rounded-md border-2 border-dashed px-4 py-3 transition-colors',
        isDisabled
          ? 'border-gray-200 bg-gray-50'
          : dragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50',
      ].join(' ')}
    >
      {/* hidden real file input — label click opens it natively */}
      <input
        id={inputId}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={isDisabled}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (file) { await processFile(file); e.target.value = '' }
        }}
      />

      {uploading ? (
        <p className="text-center text-xs font-medium text-blue-700">Reading file…</p>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {/* Click-to-browse button — uses htmlFor so click is always reliable */}
          <label
            htmlFor={inputId}
            className={[
              'inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors',
              isDisabled
                ? 'cursor-not-allowed border-gray-200 text-gray-400'
                : 'cursor-pointer border-blue-400 text-blue-700 hover:bg-blue-100',
            ].join(' ')}
          >
            <span>⬆</span>
            <span>Click to upload</span>
          </label>

          <span className="text-xs text-gray-400">or</span>

          <span className={`text-xs font-medium ${dragging ? 'text-blue-700' : 'text-gray-500'}`}>
            {dragging ? 'Drop file here' : 'drag & drop PDF / Word'}
          </span>
        </div>
      )}
    </div>
  )
}
