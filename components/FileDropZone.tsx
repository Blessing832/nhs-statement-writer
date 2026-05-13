'use client'
import { useState, useCallback, useRef } from 'react'

interface FileDropZoneProps {
  onText: (text: string) => void
  disabled?: boolean
}

const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function FileDropZone({ onText, disabled }: FileDropZoneProps) {
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-label="Upload person specification PDF or Word file"
      onClick={() => !isDisabled && inputRef.current?.click()}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) inputRef.current?.click() }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={[
        'flex flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed px-4 py-3 text-center transition-colors select-none',
        isDisabled
          ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
          : dragging
          ? 'cursor-copy border-blue-500 bg-blue-50 text-blue-700'
          : 'cursor-pointer border-gray-300 bg-white text-gray-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700',
      ].join(' ')}
    >
      <input
        ref={inputRef}
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
        <span className="text-xs font-medium">Reading file…</span>
      ) : (
        <>
          <span className="text-lg leading-none">{dragging ? '📂' : '⬆'}</span>
          <span className="text-xs font-medium">
            {dragging ? 'Drop to upload' : 'Drop PDF / Word here'}
          </span>
          <span className="text-xs opacity-70">or click to browse</span>
        </>
      )}
    </div>
  )
}
